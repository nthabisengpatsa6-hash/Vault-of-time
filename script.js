// === FIREBASE IMPORTS ================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// === FIREBASE CONFIG ================================
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
const blocksCollection = collection(db, "blocks");

// === STATE ==========================================
let claimedBlocks = [];
let selectedBlock = null;
const blockPrice = 6.0;
const RETURN_URL = "https://vaultoftime.com";
const CANCEL_URL = "https://vaultoftime.com";

// === FIRESTORE LOAD ================================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function fetchBlock(number) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(number)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

async function saveBlock(number, name, email, message) {
  await setDoc(doc(blocksCollection, String(number)), {
    name,
    email,
    message: message || null,
    purchasedAt: serverTimestamp()
  });
}

// === APP ============================================
document.addEventListener("DOMContentLoaded", async () => {

  // === LOADING OVERLAY ===========================
  const overlay = document.createElement("div");
  overlay.style = `
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at top, #141922, #05070b);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    color: #f9d26e;
    font-size: 22px;
    transition: opacity .4s;
  `;
  overlay.innerHTML = `
    <div style="font-size:50px;">🕰️</div>
    <div style="margin-top:6px;">The Vault is opening…</div>
  `;
  document.body.appendChild(overlay);

  const hideOverlay = () => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 400);
  };

  // === DOM REFS =================================
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const closeBtn = document.querySelector(".close-button");
  const viewClose = document.querySelector(".close-view");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const readyMsg = document.getElementById("ready-message");
  const payContainer = document.getElementById("paypal-button-container");

  const viewBlockTitle = document.getElementById("viewBlockTitle");
  const viewBlockMessage = document.getElementById("viewBlockMessage");
  const viewBlockMedia = document.getElementById("viewBlockMedia");

  // === LOAD BLOCKS ==============================
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocks();

  // === BUILD GRID ===============================
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;
      if (claimedBlocks.includes(i)) div.classList.add("claimed");
      grid.appendChild(div);
    }
  }
  buildGrid();

  function refreshGrid() {
    document.querySelectorAll(".block").forEach(b => {
      const num = Number(b.textContent);
      if (claimedBlocks.includes(num)) b.classList.add("claimed");
    });
  }

  // === SELECT BLOCK ==============================
  grid.addEventListener("click", async e => {
    if (!e.target.classList.contains("block")) return;

    const num = Number(e.target.textContent);

    if (claimedBlocks.includes(num)) {
      const data = await fetchBlock(num);
      viewBlockTitle.textContent = `Block #${num}`;
      viewBlockMessage.textContent = data?.message || "(no message)";
      viewBlockMedia.innerHTML = ""; // image support coming soon
      viewModal.classList.remove("hidden");
      return;
    }

    document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
    e.target.classList.add("selected");
    selectedBlock = num;
    document.getElementById("selected-block-text").textContent = `Selected Block: #${num}`;
    modal.classList.remove("hidden");
  });

  // === CLOSE MODALS ==============================
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === FORM LOGIC ================================
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selectedBlock
    );
  }

  function fileOK() {
    const f = fileInput.files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("File too large (2MB max)");
      return false;
    }
    return true;
  }

  function updateGate() {
    if (!fileOK()) return;
    if (valid()) {
      readyMsg.classList.add("show");
      payContainer.classList.add("show");
    }
  }

  document.getElementById("uploadBtn").onclick = updateGate;
  document.getElementById("blockForm").addEventListener("input", updateGate, true);

  // === PAYPAL REDIRECT MODE ======================
  payContainer.innerHTML = `
    <button id="payNowButton" style="
      background:#ffc439;
      border:none;
      border-radius:6px;
      padding:12px 18px;
      font-size:16px;
      font-weight:600;
      cursor:pointer;
      width:100%;
      margin-top:8px;
    ">Pay $6 Securely</button>
  `;

  document.getElementById("payNowButton").onclick = async () => {
    if (!valid()) return;

    const resp = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa("sb:sb")}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { value: blockPrice.toFixed(2) }
        }],
        application_context: {
          return_url: RETURN_URL,
          cancel_url: CANCEL_URL
        }
      })
    });

    const data = await resp.json();
    const approval = data.links.find(l => l.rel === "approve");
    window.open(approval.href, "_blank");
  };

  // === ACCORDION ================================
  document.querySelectorAll(".accordion-header").forEach(h => {
    h.addEventListener("click", () => {
      const isOpen = h.classList.contains("active");
      document.querySelectorAll(".accordion-header").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(x => x.classList.remove("show"));
      if (!isOpen) {
        h.classList.add("active");
        h.nextElementSibling.classList.add("show");
      }
    });
  });

  // === MENU =====================================
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const menuOverlay = document.getElementById("overlay");

  menuToggle.onclick = () => {
    sideMenu.classList.add("open");
    menuOverlay.classList.add("show");
  };

  document.getElementById("closeMenu").onclick = () => {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("show");
  };

  menuOverlay.onclick = () => {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("show");
  };

  hideOverlay();
});
