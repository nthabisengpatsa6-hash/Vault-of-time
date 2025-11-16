// === FIREBASE IMPORTS & SETUP ===============================================
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

// Firebase Config -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDo9YzptBrAvJy7hjiGh1YSy20lZzOKVZc",
  authDomain: "vault-of-time-e6c03.firebaseapp.com",
  projectId: "vault-of-time-e6c03",
  storageBucket: "vault-of-time-e6c03.firebasestorage.app",
  messagingSenderId: "941244238426",
  appId: "1:941244238426:web:80f80b5237b84b1740e663"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firestore "blocks" collection
const blocksCollection = collection(db, "blocks");

// Cache
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);
    claimedBlocks = snapshot.docs.map((d) => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    console.error("Error loading Firestore:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function saveBlock(blockNumber, name, email, message) {
  await setDoc(doc(blocksCollection, String(blockNumber)), {
    name,
    email,
    message: message || null,
    purchasedAt: serverTimestamp()
  });
}

// ============================================================================
// DOM / UI LOGIC
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {

  // ========= LOADING OVERLAY ==========
  const loadingOverlay = document.createElement("div");
  loadingOverlay.id = "vault-loading-overlay";
  Object.assign(loadingOverlay.style, {
    position: "fixed",
    inset: "0",
    background:
      "radial-gradient(circle at top, #141922 0%, #05070b 55%, #020308 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "9999",
    color: "#f9d26e",
    fontFamily: "system-ui",
    transition: "opacity .4s ease"
  });
  loadingOverlay.innerHTML = `
    <div style="font-size:42px;margin-bottom:10px;">🕰️</div>
    <div style="font-size:20px;font-weight:600;margin-bottom:4px;">
      The Vault is opening…
    </div>
    <div style="font-size:14px;opacity:0.8;">Loading memory blocks…</div>
  `;
  document.body.appendChild(loadingOverlay);

  const hideOverlay = () => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => loadingOverlay.remove(), 400);
  };

  // ========= REFS =========
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeBtn = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");
  const messageInput = document.getElementById("messageBox");
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  const blockPrice = 6.00;
  let selectedBlockNumber = null;
  let paypalRendered = false;

  // ========= LOAD CLAIMS =========
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocksFromFirestore();

  // ========= BUILD GRID =========
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.classList.add("block");
      div.textContent = i;

      if (claimedBlocks.includes(i)) {
        div.classList.add("claimed");
        div.style.cursor = "not-allowed";
      }
      grid.appendChild(div);
    }
  }

  buildGrid();

  // ========= CLICK HANDLERS =========
  document.querySelectorAll(".block").forEach(block => {
    block.addEventListener("click", () => {
      const num = Number(block.textContent);
      if (!num || claimedBlocks.includes(num)) return;

      selectedBlockNumber = num;

      modal.classList.remove("hidden");
      document.getElementById("blockNumber").value = num;
      document.getElementById("selected-block-text").textContent =
        `Selected Block: #${num}`;
    });
  });

  closeBtn?.addEventListener("click", () => modal.classList.add("hidden"));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // ========= FORM VALIDATION =========
  function validateFileSize() {
    const f = document.getElementById("fileUpload").files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("❌ File must be under 2MB.");
      document.getElementById("fileUpload").value = "";
      return false;
    }
    return true;
  }

  function canCheckout() {
    return (
      document.getElementById("name").value.trim() &&
      document.getElementById("email").value.trim() &&
      document.getElementById("fileUpload").files.length > 0 &&
      selectedBlockNumber
    );
  }

  function updatePayGate() {
    if (!validateFileSize()) {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
      return;
    }

    if (canCheckout()) {
      readyMsg.classList.add("show");

      if (!paypalRendered) {
        paypalRendered = true;
        renderSplitPayButtons();
      }

      paypalContainer.classList.add("show");
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  form?.addEventListener("input", updatePayGate);
  form?.addEventListener("change", updatePayGate);
  saveBtn?.addEventListener("click", updatePayGate);

  // ========= PAYPAL BUTTONS (SANDBOX FRIENDLY) =========
  function renderSplitPayButtons() {
    paypalContainer.innerHTML = "";

    const buttonConfig = (fundingSource) => ({
      fundingSource,
      style: { color: "gold", shape: "pill", label: "pay", height: 45 },

      createOrder: (data, actions) => actions.order.create({
        purchase_units: [{
          description: `Vault Block #${selectedBlockNumber}`,
          amount: { value: blockPrice.toFixed(2) }
        }]
      }),

      // 👇 SANDBOX SAFE APPROVE BLOCK
      onApprove: async () => {
        await finishTransaction({
          payer: { name: { given_name: "SandboxUser" } }
        });
      },

      onError: (err) => console.error("PayPal error:", err)
    });

    paypal.Buttons(buttonConfig(paypal.FUNDING.PAYPAL))
      .render("#paypal-button-container");

    paypal.Buttons(buttonConfig(paypal.FUNDING.CARD))
      .render("#paypal-button-container");
  }

  // ========= SUCCESS HANDLER =========
  async function finishTransaction(details) {
    alert(`✅ Payment completed by ${details?.payer?.name?.given_name ?? "User"}.`);

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = messageInput?.value.trim() || null;

    await saveBlock(selectedBlockNumber, name, email, message);

    if (!claimedBlocks.includes(selectedBlockNumber)) {
      claimedBlocks.push(selectedBlockNumber);
      localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    }

    modal.classList.add("hidden");

    applyClaimBlockStyles();
    generateCertificatePDF(name, selectedBlockNumber);
  }

  // ========= UPDATE GRID =========
  function applyClaimBlockStyles() {
    document.querySelectorAll(".block").forEach(div => {
      const num = Number(div.textContent);
      if (claimedBlocks.includes(num)) {
        div.classList.add("claimed");
        div.style.cursor = "not-allowed";
      }
    });
  }

  applyClaimBlockStyles();
  hideOverlay();

  // ========= CERTIFICATE =========
  function generateCertificatePDF(name, blockNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, W, H, "F");

    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(6);
    doc.rect(30, 30, W - 60, H - 60);

    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.text("Vault Of Time Certificate of Ownership", W / 2, 120, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("This certifies that", W / 2, 200, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(26);
    doc.text(name, W / 2, 240, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text(`is the rightful guardian of Block #${blockNumber}`, W / 2, 280, { align: "center" });
    doc.text("Sealed within The Vault.", W / 2, 310, { align: "center" });

    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, W / 2, 360, { align: "center" });

    doc.save(`VaultOfTime_Block${blockNumber}.pdf`);
  }

});
