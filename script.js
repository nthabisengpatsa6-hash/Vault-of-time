
// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, 
  addDoc, serverTimestamp, query, orderBy, limit, where 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ================= CONFIG & SCARCITY =================
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
const auth = getAuth(app);
const storage = getStorage(app);

const TOTAL_BLOCKS = 50; 
let blockCache = {};
let claimed = [];
let loggedInUserEmail = null;

// ================= THE FANCY "SECURITY HANDSHAKE" LOADER =================
function performHandshake() {
  const loader = document.getElementById("vault-loader");
  if (!loader) return;

  if (!loader.querySelector(".vault-spinner-box")) {
      loader.innerHTML = `
        <div class="vault-spinner-box">
            <div class="vault-ring"></div>
            <div class="vault-core"></div>
        </div>
        <div class="vault-loader-text">INITIALIZING PROTOCOL...</div>
      `;
  }

  const loaderText = loader.querySelector(".vault-loader-text");
  const messages = [
    "Verifying Curation Standards...",
    "Syncing with the Ledger...",
    "Authenticating Coordinates...",
    "Access Granted."
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (loaderText) {
      loaderText.style.opacity = 0.2;
      setTimeout(() => {
        loaderText.textContent = messages[i];
        loaderText.style.opacity = 1;
        i++;
      }, 150);
    }
    
    if (i >= messages.length) {
      clearInterval(interval);
      setTimeout(hideLoader, 600); 
    }
  }, 1200); 
}

function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");
  
  if (loader) {
    loader.style.opacity = 0;
    setTimeout(() => loader.remove(), 800);
  }
  if (main) main.classList.add("vault-main-visible");
}

// ================= SESSION & AUTH =================
function checkSession() {
    const session = localStorage.getItem('vault_session');
    const loginModal = document.getElementById("loginModal"); 
    const loginBtn = document.getElementById("menuLoginBtn");

    if (session) {
        try {
            const { email, expiresAt } = JSON.parse(session);
            if (Date.now() < expiresAt) {
                loggedInUserEmail = email;
                if (loginModal) loginModal.classList.add("hidden");
                if (loginBtn) {
                    const shortName = email.split('@')[0];
                    loginBtn.innerHTML = `👤 ${shortName.toUpperCase()} <span style="font-size: 0.7em; opacity: 0.6; margin-left: 10px;">(DISCONNECT)</span>`;
                    loginBtn.style.color = "#D4AF37";
                }
            } else {
                localStorage.removeItem('vault_session');
                loggedInUserEmail = null;
            }
        } catch (e) {
            localStorage.removeItem('vault_session');
            loggedInUserEmail = null;
        }
    }
}

// ================= THE AUCTION RATCHET =================
async function getCurrentFloorPrice() {
  try {
    const q = query(collection(db, "ledger"), orderBy("blockId", "desc"), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) return 1000; 
    
    const lastPrice = snap.docs[0].data().price;
    return Math.ceil(lastPrice * 1.1); 
  } catch (err) {
    console.error("Price fetch error:", err);
    return 1000;
  }
}

// ================= CORE DATA FETCH =================
async function loadVault() {
  try {
      const [blocksSnap, ledgerSnap] = await Promise.all([
          getDocs(collection(db, "blocks")),
          getDocs(collection(db, "ledger"))
      ]);

      claimed = [];
      blockCache = {};
      
      ledgerSnap.forEach(d => {
        claimed.push(Number(d.data().blockId));
      });

      blocksSnap.forEach(d => {
        blockCache[d.id] = d.data();
      });

      renderGrid();
  } catch (err) {
      console.error("Error loading vault:", err);
  }
}

// ================= GALLERY RENDERING =================
async function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  grid.innerHTML = ""; 
  const floorPrice = await getCurrentFloorPrice();
  let activeFound = false;

  for (let i = 1; i <= TOTAL_BLOCKS; i++) {
    const div = document.createElement("div");
    div.className = "block";
    
    const isSold = claimed.includes(i);

    if (isSold) {
      div.classList.add("claimed");
      div.innerHTML = `<span class="coord-num">#${i}</span>`;
      const data = blockCache[i];
      if (data && data.mediaUrl && data.mediaType === "image") {
        div.style.backgroundImage = `url(${data.mediaUrl})`;
        div.style.backgroundSize = "cover";
        div.querySelector(".coord-num").style.display = "none";
      }
      div.onclick = () => handleCoordinateClick(i, "sold");
    } 
    else if (!activeFound) {
      div.classList.add("active-bid");
      div.innerHTML = `
        <span class="coord-num" style="color:#D4AF37;">#${i}</span>
        <span class="price-tag">BID OPEN: $${floorPrice}</span>
      `;
      div.onclick = () => handleCoordinateClick(i, "active", floorPrice);
      activeFound = true; 
    } 
    else {
      div.classList.add("locked");
      div.innerHTML = `<span class="coord-num">#${i}</span><span class="lock-icon">🔒</span>`;
      div.onclick = () => alert("This coordinate is currently locked until the previous block is etched.");
    }
    grid.appendChild(div);
  }
}

// ================= MODAL ROUTING =================
async function handleCoordinateClick(id, state, price) {
  const viewModal = document.getElementById("viewModal");
  const inquiryModal = document.getElementById("modal");
  
  if (state === "sold") {
    const data = blockCache[id];
    document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
    document.getElementById("viewBlockMessage").textContent = data ? data.message : "Archives sealed.";
    const mediaContainer = document.getElementById("viewBlockMedia");
    
    if (data && data.mediaType === "image") {
        mediaContainer.innerHTML = `<img src="${data.mediaUrl}" style="width:100%; border-radius: 4px;">`;
    } else {
        mediaContainer.innerHTML = "";
    }
    viewModal.classList.remove("hidden");
  } 
  else if (state === "active") {
    document.getElementById("blockNumber").value = id;
    document.getElementById("selected-block-text").textContent = `Coordinate #${id}: Apply to Bid`;
    inquiryModal.classList.remove("hidden");
  }
}

// ================= SUBMIT APPLICATION =================
async function handleInquiry() {
  const btn = document.getElementById("uploadBtn");
  const blockId = document.getElementById("blockNumber").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const name = document.getElementById("name").value.trim();
  const bidAmount = document.getElementById("bidAmount").value; // Grab the money
  const message = document.getElementById("message").value;

  if (!email || !name || !bidAmount) return alert("Credentials and Bid Amount required.");
  
  btn.disabled = true;
  btn.textContent = "Etching Application...";

  try {
    // 1. Log to Firestore
    await addDoc(collection(db, "inquiries"), {
      coordinate: blockId,
      bidderEmail: email,
      bidderName: name,
      bidAmount: bidAmount,
      message: message,
      timestamp: serverTimestamp(),
      status: "reviewing"
    });

    // 2. Send via EmailJS using YOUR NEW TEMPLATE
    if (window.emailjs) {
      await emailjs.send("service_pmuwoaa", "template_a0yyy47", {
        name: name, 
        email: email, 
        coordinate: blockId, 
        bidAmount: bidAmount,
        message: message,
        note: "New high-prestige bid application."
      });
    }

    alert("Application Logged. The Curator will review your credentials.");
    document.getElementById("modal").classList.add("hidden");
    
    // Clear form for next time
    document.getElementById("email").value = "";
    document.getElementById("name").value = "";
    document.getElementById("bidAmount").value = "";
    document.getElementById("message").value = "";

  } catch (err) {
    console.error(err);
    alert("Vault restricted. Check your connection.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Application to Bid";
  }
}

// ================= THE GENESIS KEY CHECK =================
async function verifyAccessKey() {
    const email = document.getElementById("loginEmailInput").value.trim().toLowerCase();
    const enteredKey = document.getElementById("loginKeyInput").value.trim();
    const loginBtn = document.getElementById("loginSendBtn");

    if (!email || !enteredKey) return alert("Credentials required.");

    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying...";

    try {
        const snap = await getDoc(doc(db, "authorized_bidders", email));
        if (snap.exists() && snap.data().accessKey === enteredKey) {
            localStorage.setItem('vault_session', JSON.stringify({ 
                email: email, 
                expiresAt: Date.now() + 21600000 
            }));
            alert(`✅ Access Granted. Welcome, ${snap.data().bidderName || "Keeper"}.`);
            checkSession(); 
            document.getElementById("loginModal").classList.add("hidden");
        } else {
            alert("❌ Invalid Credentials.");
        }
    } catch (err) {
        alert("Verification restricted.");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Verify Identity";
    }
}

// ================= ACCORDION MENU LOGIC =================
function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    headers.forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.onclick = function() {
            if (this.id === "menuLoginBtn") {
                if (loggedInUserEmail) {
                    if(confirm("Sever connection to the Vault?")) {
                        localStorage.removeItem('vault_session');
                        location.reload();
                    }
                    return;
                }
                document.getElementById("loginModal").classList.remove("hidden");
                return;
            }

            this.classList.toggle("active");
            const content = this.nextElementSibling;
            if (content && content.classList.contains("accordion-content")) {
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    content.style.opacity = 0;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    content.style.opacity = 1;
                }
            }
        };
    });
}

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  onAuthStateChanged(auth, (user) => { if (!user) signInAnonymously(auth); });
  loadVault();
  performHandshake();
  initAccordion();

  document.querySelector(".close-button").onclick = () => document.getElementById("modal").classList.add("hidden");
  document.querySelector(".close-view").onclick = () => document.getElementById("viewModal").classList.add("hidden");
  document.querySelector(".close-login").onclick = () => document.getElementById("loginModal").classList.add("hidden");

  document.getElementById("uploadBtn").onclick = handleInquiry;
  document.getElementById("loginSendBtn").onclick = verifyAccessKey;
  document.getElementById("menuToggle").onclick = () => document.getElementById("sideMenu").classList.add("open");
  document.getElementById("closeMenu").onclick = () => document.getElementById("sideMenu").classList.remove("open");
});
