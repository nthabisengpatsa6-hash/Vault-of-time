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

// Expose Firestore globally (PREVENTS MODULE LOAD ERRORS)
window.db = db;

// Collection reference
const blocksCollection = collection(db, "blocks");

// Memory cache
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

// Load the list of claimed blocks (doc IDs)
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);
    claimedBlocks = snapshot.docs.map(docSnap => Number(docSnap.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    console.log("Loaded claimed blocks:", claimedBlocks);
  } catch (err) {
    console.error("Firestore error, falling back to local:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function isBlockClaimedRemote(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    return snap.exists();
  } catch (err) {
    console.error("Error checking Firestore:", err);
    return claimedBlocks.includes(blockNumber);
  }
}

async function saveBlockToFirestore(blockNumber, name, email) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      purchasedAt: serverTimestamp()
    });
    console.log(`Saved Block #${blockNumber} to Firestore`);
  } catch (err) {
    console.error("Failed to save block:", err);
  }
}

// ============================================================================
// APP START
// ============================================================================
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Vault script loaded successfully.");

  // DOM refs
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  const visibleRange = [1, 100];
  const founderBlock = 1;
  const blockPrice = 6.00;

  let selectedBlockNumber = null;

  // Load remote claims BEFORE building grid
  await loadClaimedBlocksFromFirestore();

  // ========================================================================
  // GRID GENERATION
  // ========================================================================
  grid.innerHTML = "";

  for (let i = visibleRange[0]; i <= visibleRange[1]; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;

    if (i === founderBlock) {
      block.classList.add("founder");
      block.style.border = "2px solid gold";
      block.style.cursor = "not-allowed";
    }

    if (claimedBlocks.includes(i)) {
      block.classList.add("claimed");
      block.style.cursor = "not-allowed";
    }

    grid.appendChild(block);
  }

  const msg = document.createElement("p");
  msg.style.textAlign = "center";
  msg.style.color = "#d4af37";
  msg.style.marginTop = "1rem";
  msg.style.fontWeight = "600";
  msg.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}).`;
  grid.insertAdjacentElement("afterend", msg);

  // ========================================================================
  // BLOCK CLICK
  // ========================================================================
  document.querySelectorAll(".block").forEach((block, index) => {
    const blockNumber = index + visibleRange[0];

    if (claimedBlocks.includes(blockNumber) || blockNumber === founderBlock) return;

    block.addEventListener("click", async () => {
      const taken = await isBlockClaimedRemote(blockNumber);
      if (taken) {
        alert("⚠️ This block has just been claimed. Please pick another.");
        block.classList.add("claimed");
        block.style.cursor = "not-allowed";
        return;
      }

      document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
      block.classList.add("selected");

      selectedBlockNumber = blockNumber;
      modal.classList.remove("hidden");

      document.getElementById("blockNumber").value = blockNumber;
      document.getElementById("selected-block-text").textContent = `Selected Block: #${blockNumber}`;
    });
  });

  // ========================================================================
  // MODAL CLOSE
  // ========================================================================
  closeButton?.addEventListener("click", () => modal.classList.add("hidden"));
  modal?.addEventListener("click", e => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // ========================================================================
  // PAYPAL + FILE VALIDATION
  // ========================================================================
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  function canCheckout() {
    return (
      document.getElementById("name").value.trim() &&
      document.getElementById("email").value.trim() &&
      document.getElementById("fileUpload").files.length > 0 &&
      selectedBlockNumber
    );
  }

  function validateFileSize() {
    const f = document.getElementById("fileUpload").files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("❌ File larger than 2MB.");
      document.getElementById("fileUpload").value = "";
      return false;
    }
    return true;
  }

  function updateGate() {
    if (!validateFileSize()) {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
      return;
    }
    if (canCheckout()) {
      readyMsg.classList.add("show");
      paypalContainer.classList.add("show");
      renderPayPalButton();
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  saveBtn?.addEventListener("click", updateGate);
  form?.addEventListener("input", updateGate, true);

  // ========================================================================
  // PAYPAL BUTTON
  // ========================================================================
  function renderPayPalButton() {
    paypalContainer.innerHTML = "";

    paypal.Buttons({
      style: { color: "gold", shape: "pill", label: "pay", height: 45 },

      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            description: `Vault of Time Block #${selectedBlockNumber}`,
            amount: { value: blockPrice.toFixed(2) }
          }]
        });
      },

      onApprove: (data, actions) => {
        return actions.order.capture().then(async details => {
          alert(`✅ Payment completed by ${details.payer.name.given_name}.`);

          const name = document.getElementById("name").value.trim();
          const email = document.getElementById("email").value.trim();

          await saveBlockToFirestore(selectedBlockNumber, name, email);

          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

          const b = document.querySelector(".block.selected");
          if (b) {
            b.classList.remove("selected");
            b.classList.add("claimed");
            b.style.cursor = "not-allowed";
          }

          modal.classList.add("hidden");

          generateCertificatePDF(name, selectedBlockNumber);
        });
      },

      onCancel: () => alert("❌ Transaction cancelled."),
      onError: err => {
        console.error(err);
        alert("Payment error.");
      }
    }).render("#paypal-button-container");
  }

  // ========================================================================
  // MENU
  // ========================================================================
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  menuToggle?.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  });

  closeMenu?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });

  overlay?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });

  // ========================================================================
  // ACCORDION
  // ========================================================================
  function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    headers.forEach(header => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const open = content.classList.contains("show");
        document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
        document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
        if (!open) {
          content.classList.add("show");
          header.classList.add("active");
        }
      };
    });
  }
  setTimeout(initAccordion, 200);

  // ========================================================================
  // CERTIFICATE
  // ========================================================================
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
    doc.text("Sealed within The Vault until 2050.", W / 2, 310, { align: "center" });

    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, W / 2, 360, { align: "center" });

    doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
  }

  // ========================================================================
  // RULES BANNER
  // ========================================================================
  const banner = document.getElementById("rulesBanner");
  const ackBtn = document.getElementById("ackRulesBtn");
  const openHowToBtn = document.getElementById("openHowTo");
  const openRulesBtn = document.getElementById("openRules");

  if (banner && !localStorage.getItem("vaultRulesAcknowledged")) {
    banner.classList.remove("hidden");
  }

  ackBtn?.addEventListener("click", () => {
    banner.classList.add("hidden");
    localStorage.setItem("vaultRulesAcknowledged", "true");
  });

  function openAccordionByText(txt) {
    document.querySelectorAll(".accordion-header").forEach(header => {
      if (header.textContent.includes(txt)) {
        const content = header.nextElementSibling;
        content.classList.add("show");
        header.classList.add("active");
        sideMenu.classList.add("open");
        overlay.classList.add("show");
      }
    });
  }

  openHowToBtn?.addEventListener("click", () => openAccordionByText("How To Buy"));
  openRulesBtn?.addEventListener("click", () => openAccordionByText("Vault Rules"));
});
