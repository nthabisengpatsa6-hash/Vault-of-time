// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// ================= FIREBASE CONFIG ==================
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
const storage = getStorage(app);
const blocksCollection = collection(db, "blocks");

// ================= GLOBAL CONFIG & STATE ====================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
const MAX_MESSAGE_LENGTH = 300;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

let isMultiSelect = false;
let selectedBatch = [];
let lastClickedId = null;
let loggedInUserEmail = null;
let rangeStartId = null;
let currentPage = 1;
let claimed = [];          
let reservedBlocks = [];   
let blockCache = {};       

// UI Element Holders
let bulkBar, bulkCount, markStartBtn, bulkReserveBtn;
let modal, viewModal, nameInput, emailInput, messageInput, messageCounter, fileInput;
let saveBtn, hiddenBlockNumber, searchInput, searchBtn, loginModal, menuLoginBtn;

// ================= SESSION MANAGEMENT =================
const sessionData = localStorage.getItem('vault_session');
if (sessionData) {
    const session = JSON.parse(sessionData);
    if (Date.now() < session.expiresAt) {
        loggedInUserEmail = session.email;
        setTimeout(() => {
            const loginBtn = document.getElementById('menuLoginBtn');
            if (loginBtn) {
                loginBtn.innerHTML = "👤 " + session.email;
                loginBtn.style.color = "#4CAF50";
            }
        }, 200);
    } else {
        localStorage.removeItem('vault_session');
    }
}

// ================= HELPER FUNCTIONS =================

function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");
  setTimeout(() => {
    if (loader) {
      loader.style.opacity = 0;
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 400);
    }
    if (main) main.classList.add("vault-main-visible");
  }, 1600);
}

async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

function updateBulkBar() {
    if (!bulkBar || !bulkCount) return;
    if (selectedBatch.length > 0) {
        bulkBar.classList.remove("hidden");
        bulkBar.style.display = "flex";
        bulkCount.textContent = `${selectedBatch.length} Blocks Selected`;
    } else {
        bulkCount.textContent = "0 Blocks Selected";
    }
}

function updateKeeper(pageNum) {
    const keeperText = document.getElementById("keeper-text");
    const keeperTitle = document.getElementById("keeper-title");
    if (keeperText && keeperTitle) {
        let title = "Plaza Mayor"; 
        let content = "THE PLAZA. Tell the future you were here.";
        if (pageNum <= 50) { title = "Arena Guide"; content = "Welcome to THE ARENA."; }
        else if (pageNum <= 80) { title = "Boulevard Scout"; content = "Welcome to THE BOULEVARD."; }
        else if (pageNum <= 110) { title = "Lobby Admin"; content = "You've entered THE LOBBY."; }
        else if (pageNum <= 160) { title = "Stage Manager"; content = "THE STAGE is vibrating."; }
        keeperTitle.innerText = `The Keeper: ${title}`;
        keeperText.innerText = content;
    }
}

// ================= CORE ENGINE FUNCTIONS =================

async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = [];
    reservedBlocks = [];
    blockCache = {};
    
    snap.docs.forEach(d => {
      const idNum = Number(d.id);
      const data = d.data();
      blockCache[idNum] = data;
      if (data.status === "paid") claimed.push(idNum);
      else if (data.reserved === true) reservedBlocks.push(idNum);
    });

    localStorage.setItem("claimed", JSON.stringify(claimed));
    localStorage.setItem("reservedBlocks", JSON.stringify(reservedBlocks));
  } catch (err) {
    console.error("Error loading blocks:", err);
  }
}

const renderPagination = () => {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    const totalPages = Math.ceil(TOTAL_BLOCKS / PAGE_SIZE);
    pagination.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "← Prev";
    prev.disabled = currentPage === 1;
    prev.onclick = () => { currentPage--; renderPage(currentPage); };
    
    const info = document.createElement("span");
    info.textContent = `Page ${currentPage} / ${totalPages}`;
    
    const next = document.createElement("button");
    next.textContent = "Next →";
    next.disabled = currentPage === totalPages;
    next.onclick = () => { currentPage++; renderPage(currentPage); };

    pagination.appendChild(prev);
    pagination.appendChild(info);
    pagination.appendChild(next);
};

const renderPage = (pageNum) => {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";
  currentPage = pageNum;

  const start = (pageNum - 1) * PAGE_SIZE + 1;
  const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

  // Update District Headers
  const chapName = document.getElementById("chapterName");
  const chapRange = document.getElementById("chapterRange");
  let district = "THE PLAZA: Personal Legacies";
  if (pageNum <= 50) district = "THE ARENA: Sports & GOATs";
  else if (pageNum <= 80) district = "THE BOULEVARD: Iconic Brands";
  else if (pageNum <= 110) district = "THE LOBBY: Gaming & Tech";
  else if (pageNum <= 160) district = "THE STAGE: Culture & Amapiano";
  
  if (chapName) chapName.textContent = district;
  if (chapRange) chapRange.textContent = `Blocks ${start} – ${end}`;
  updateKeeper(pageNum);

  for (let i = start; i <= end; i++) {
    const div = document.createElement("div");
    div.className = "block";
    div.textContent = i;
    div.dataset.blockId = i;

    // Visual States
    if (claimed.includes(i)) {
      div.classList.add("claimed");
      const data = blockCache[i];
      if (data?.mediaUrl && (data.mediaType === "image" || data.imageUrl)) {
        div.classList.add("claimed-has-image");
        div.style.backgroundImage = `url(${data.mediaUrl || data.imageUrl})`;
        div.style.color = "transparent";
      }
    } else if (reservedBlocks.includes(i)) {
      div.classList.add("reserved");
      div.textContent = `${i} (R)`;
    }

    // Click Handler
    div.onclick = async () => {
      if (isMultiSelect) {
        handleMultiSelect(i, div);
        return;
      }
      handleSingleClick(i, div);
    };

    grid.appendChild(div);
  }
  renderPagination();
};

// ================= INTERACTION HANDLERS =================

async function handleSingleClick(i, div) {
    hiddenBlockNumber.value = i;
    const selectedText = document.getElementById("selected-block-text");
    document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
    div.classList.add("selected");

    if (claimed.includes(i)) {
        const data = await fetchBlock(i);
        if (selectedText) selectedText.textContent = `Viewing Legacy: Block #${i}`;
        // Logic for view modal
        const viewModal = document.getElementById("viewModal");
        if (viewModal) viewModal.classList.remove("hidden");
    } else {
        if (selectedText) selectedText.textContent = `Selected Block: #${i}`;
        if (modal) modal.classList.remove("hidden");
    }
}

function handleMultiSelect(i, div) {
    if (claimed.includes(i)) return alert("Already purchased.");
    if (selectedBatch.includes(i)) {
        selectedBatch = selectedBatch.filter(id => id !== i);
        div.classList.remove("multi-selected");
    } else {
        selectedBatch.push(i);
        div.classList.add("multi-selected");
    }
    updateBulkBar();
}

// ================= STARTUP & DOM LISTENERS =================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Grab all UI elements
    bulkBar = document.getElementById("bulkActionBar");
    bulkCount = document.getElementById("bulkCount");
    markStartBtn = document.getElementById("markStartBtn");
    bulkReserveBtn = document.getElementById("bulkReserveBtn");
    modal = document.getElementById("modal");
    viewModal = document.getElementById("viewModal");
    nameInput = document.getElementById("name");
    emailInput = document.getElementById("email");
    saveBtn = document.getElementById("uploadBtn");
    hiddenBlockNumber = document.getElementById("blockNumber");
    searchInput = document.getElementById("blockSearch");
    searchBtn = document.getElementById("searchBtn");

    // 2. Initialize the Vault
    console.log("Vault Powering Up...");
    await loadClaimedBlocks();
    renderPage(1);
    hideLoader();

    // 3. Simple Close Modals (The Peace Treaty)
    document.querySelectorAll(".close-button, .close-view, .close-login").forEach(btn => {
        btn.onclick = () => {
            if (modal) modal.classList.add("hidden");
            if (viewModal) viewModal.classList.add("hidden");
            const loginM = document.getElementById("loginModal");
            if (loginM) loginM.classList.add("hidden");
        };
    });

    // 4. Search Functionality
    if (searchBtn && searchInput) {
        searchBtn.onclick = () => {
            const target = Number(searchInput.value);
            if (!target || target < 1 || target > TOTAL_BLOCKS) return;
            const page = Math.ceil(target / PAGE_SIZE);
            renderPage(page);
            setTimeout(() => {
                const el = document.querySelector(`[data-block-id='${target}']`);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("search-highlight");
                }
            }, 500);
        };
    }

    // 5. Multi-Select Toggle
    const toggle = document.getElementById("multiSelectMode");
    if (toggle) {
        toggle.addEventListener("change", (e) => {
            isMultiSelect = e.target.checked;
            selectedBatch = [];
            document.querySelectorAll(".block").forEach(b => b.classList.remove("multi-selected"));
            updateBulkBar();
        });
    }

    // 6. PayPal Redirect
    const payBtn = document.getElementById("paypalBtn");
    if (payBtn) {
        payBtn.onclick = () => {
            const blockId = hiddenBlockNumber.value;
            if (!blockId) return alert("No block selected.");
            localStorage.setItem("pendingBlockId", blockId);
            window.location.href = `https://vaultoftime.com/paypal/pay.php?block=${blockId}`;
        };
    }
});
