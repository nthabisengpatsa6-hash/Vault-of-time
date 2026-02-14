// ================= 1. FIREBASE CONFIG =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDo9YzptBrAvJy7hjiGh1YSy20lZzOKVZc",
  authDomain: "vault-of-time-e6c03.firebaseapp.com",
  projectId: "vault-of-time-e6c03",
  storageBucket: "vault-of-time-e6c03.firebasestorage.app",
  messagingSenderId: "941244238426",
  appId: "1:941244238426:web:80f80b5237b84b1740e663"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global State
const TOTAL_BLOCKS = 50;
let blockCache = {};
let claimedBlocks = [];
let countdownInterval = null;

// ================= 2. THE ALCHEMY ENGINE (p5.js) =================

function generateHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; 
    }
    return Math.abs(hash);
}

function renderGenerativeArt(blockId, containerId, data) {
    // 1. Prepare Ingredients
    let message = data.message || "Legacy";
    let timestamp = data.purchasedAt ? data.purchasedAt.toMillis() : Date.now();
    let price = data.purchasePrice || 1000;
    
    // 2. Inject Rare Phrases
    let rareType = null;
    if (blockId === 1) {
        message += " Vault Of Time"; // Genesis Phrase
        rareType = "GOLD";
    } else if (blockId === 50) {
        message += " Etched in time"; // Omega Phrase
        rareType = "PLATINUM";
    }

    const seed = generateHash(message + timestamp + blockId);

    // 3. The Artist Script
    new p5((p) => {
        p.setup = () => {
            const container = document.getElementById(containerId);
            p.createCanvas(container.clientWidth, container.clientHeight).parent(containerId);
            p.randomSeed(seed);
            p.noiseSeed(seed);
            p.noLoop();
        };

        p.draw = () => {
            // Background Logic
            if (rareType === "GOLD") p.background(5, 5, 5);
            else if (rareType === "PLATINUM") p.background(15, 15, 20);
            else p.background(p.random(5, 15));

            p.noFill();
            
            // Flow Field Detail based on Price
            let lines = p.map(price, 1000, 50000, 40, 180);
            
            for (let i = 0; i < lines; i++) {
                // Determine Colors
                if (rareType === "GOLD") {
                    p.stroke(212, 175, 55, p.random(100, 200)); // Vault Gold
                } else if (rareType === "PLATINUM") {
                    p.stroke(229, 228, 226, p.random(100, 200)); // Platinum White
                } else {
                    // Unique DNA colors for regular blocks
                    p.stroke(p.random(150, 255), p.random(100, 200), p.random(50, 100), p.random(50, 150));
                }

                p.strokeWeight(p.random(0.5, 1.5));
                p.beginShape();
                let x = p.random(p.width);
                let y = p.random(p.height);
                
                for (let j = 0; j < 40; j++) {
                    p.vertex(x, y);
                    let angle = p.noise(x * 0.01, y * 0.01, i) * p.TWO_PI * 4;
                    x += p.cos(angle) * 4;
                    y += p.sin(angle) * 4;
                }
                p.endShape();
            }
        };
    }, containerId);
}

// ================= 3. CORE LOGIC =================

async function getCurrentFloorPrice() {
    const q = query(collection(db, "ledger"), orderBy("blockId", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return 1000;
    return Math.ceil(snap.docs[0].data().price * 1.1);
}

async function loadVault() {
    const [blocksSnap, ledgerSnap] = await Promise.all([
        getDocs(collection(db, "blocks")),
        getDocs(collection(db, "ledger"))
    ]);

    claimedBlocks = ledgerSnap.docs.map(d => Number(d.data().blockId));
    blocksSnap.forEach(d => { blockCache[d.id] = d.data(); });
    renderGrid();
}

async function renderGrid() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    grid.innerHTML = "";
    const floorPrice = await getCurrentFloorPrice();
    let activeBlockFound = false;

    if (countdownInterval) clearInterval(countdownInterval);

    for (let i = 1; i <= TOTAL_BLOCKS; i++) {
        const div = document.createElement("div");
        div.className = "block";
        const isSold = claimedBlocks.includes(i) || (blockCache[i] && blockCache[i].status === "paid");

        if (isSold) {
            div.classList.add("claimed");
            const canvasId = `canvas-${i}`;
            div.id = canvasId;
            const data = blockCache[i] || {};
            // Small delay to ensure DIV is in DOM before p5 paints
            setTimeout(() => renderGenerativeArt(i, canvasId, data), 10);
            div.onclick = () => handleCoordinateClick(i, "sold");
        } 
        else if (!activeBlockFound) {
            div.classList.add("active-bid");
            const blockData = blockCache[i];
            let content = `<span class="price-tag">BID OPEN: $${floorPrice}</span>`;
            
            if (blockData && blockData.auctionEndsAt) {
                const timerId = `timer-${i}`;
                content = `<span id="${timerId}" class="price-tag">Loading...</span>`;
                setTimeout(() => startLiveCountdown(blockData.auctionEndsAt, timerId), 10);
            }

            div.innerHTML = `<span class="coord-num" style="color:#D4AF37;">#${i}</span>${content}`;
            div.onclick = () => handleCoordinateClick(i, "active", floorPrice);
            activeBlockFound = true;
        } 
        else {
            div.classList.add("locked");
            div.innerHTML = `<span class="coord-num">#${i}</span><span class="lock-icon">🔒</span>`;
            div.onclick = () => alert("This coordinate is currently locked.");
        }
        grid.appendChild(div);
    }
}

function handleCoordinateClick(id, state) {
    const viewModal = document.getElementById("viewModal");
    const inquiryModal = document.getElementById("modal");
    
    if (state === "sold") {
        const data = blockCache[id] || {};
        document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
        document.getElementById("viewBlockMessage").textContent = data.message || "The legacy is sealed.";
        
        // Render large version in modal
        const stage = document.getElementById("viewBlockMedia");
        stage.innerHTML = ""; // Clear
        const modalCanvasId = `modal-canvas-${id}`;
        const canvasDiv = document.createElement("div");
        canvasDiv.id = modalCanvasId;
        canvasDiv.style.width = "100%";
        canvasDiv.style.height = "400px"; // Fixed height for modal
        stage.appendChild(canvasDiv);
        
        renderGenerativeArt(id, modalCanvasId, data);
        viewModal.classList.remove("hidden");
    } else if (state === "active") {
        const data = blockCache[id];
        if (data && data.auctionEndsAt && (data.auctionEndsAt.toDate() < new Date())) {
            return alert("⛔ BIDDING CLOSED. Awaiting Curator selection.");
        }
        document.getElementById("blockNumber").value = id;
        inquiryModal.classList.remove("hidden");
    }
}

function startLiveCountdown(deadline, elementId) {
    const endTime = deadline.toDate().getTime();
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;

    countdownInterval = setInterval(() => {
        const distance = endTime - new Date().getTime();
        if (distance < 0) {
            clearInterval(countdownInterval);
            timerElement.innerHTML = "⛔ CLOSED";
            timerElement.style.color = "red";
        } else {
            const h = Math.floor(distance / 3600000);
            const m = Math.floor((distance % 3600000) / 60000);
            const s = Math.floor((distance % 60000) / 1000);
            timerElement.innerHTML = `⏳ ${h}h ${m}m ${s}s`;
        }
    }, 1000);
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    loadVault();
    // Safely bind close buttons
    const hide = (id) => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); };
    document.querySelectorAll(".close-button, .close-view").forEach(b => {
        b.onclick = () => { hide("modal"); hide("viewModal"); };
    });
    
    document.getElementById("uploadBtn").onclick = handleInquiry; // Assuming your existing handleInquiry function
});
