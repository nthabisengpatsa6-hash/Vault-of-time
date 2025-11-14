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

// Your Firebase config (from console)
const firebaseConfig = {
  apiKey: "AIzaSyDo9YzptBrAvJy7hjiGh1YSy20lZzOKVZc",
  authDomain: "vault-of-time-e6c03.firebaseapp.com",
  projectId: "vault-of-time-e6c03",
  storageBucket: "vault-of-time-e6c03.firebasestorage.app",
  messagingSenderId: "941244238426",
  appId: "1:941244238426:web:80f80b5237b84b1740e663"
};

// Init Firebase + Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const blocksCollection = collection(db, "blocks");

// This will be our single source of truth for claimed blocks
let claimedBlocks = [];

// Load existing claimed blocks from Firestore
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);
    claimedBlocks = snapshot.docs.map(docSnap => Number(docSnap.id));
    // Keep a local fallback
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    console.log("Loaded claimed blocks from Firestore:", claimedBlocks);
  } catch (err) {
    console.error("Error loading claimed blocks from Firestore, falling back to localStorage:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

// Check if a specific block is already claimed in Firestore
async function isBlockClaimedRemote(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    if (snap.exists()) return true;
    return false;
  } catch (err) {
    console.error("Error checking block in Firestore:", err);
    // Fallback to local cache
    return claimedBlocks.includes(blockNumber);
  }
}

// Save a newly claimed block to Firestore (Option A: minimal data)
async function saveBlockToFirestore(blockNumber, name, email) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      purchasedAt: serverTimestamp()
    });
    console.log(`Block #${blockNumber} saved to Firestore.`);
  } catch (err) {
    console.error("Error saving block to Firestore:", err);
  }
}

// ============================================================================
// MAIN APP LOGIC
// ============================================================================
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Vault of Time script loaded ✅");

  // === BASIC DOM REFS =======================================================
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  const totalBlocks = 1000;
  const visibleRange = [1, 100];
  const founderBlock = 1;
  const blockPrice = 6.00; // USD

  let selectedBlockNumber = null;

  // === LOAD CLAIMED BLOCKS FROM FIRESTORE FIRST =============================
  await loadClaimedBlocksFromFirestore();

  // === GRID LOGIC ===========================================================
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

  const message = document.createElement("p");
  message.style.textAlign = "center";
  message.style.color = "#d4af37";
  message.style.marginTop = "1rem";
  message.style.fontWeight = "600";
  message.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}). The next drop unlocks after ${visibleRange[1]} blocks are sealed.`;
  grid.insertAdjacentElement("afterend", message);

  // === BLOCK CLICK ==========================================================
  document.querySelectorAll(".block").forEach((block, index) => {
    const blockNumber = index + visibleRange[0];

    if (claimedBlocks.includes(blockNumber) || blockNumber === founderBlock) return;

    block.addEventListener("click", async () => {
      // Double-check remotely in case it was taken since page load
      const alreadyClaimed = await isBlockClaimedRemote(blockNumber);
      if (alreadyClaimed) {
        alert("⚠️ This block has just been claimed. Please pick another one.");
        block.classList.add("claimed");
        block.classList.remove("selected");
        block.style.cursor = "not-allowed";
        if (!claimedBlocks.includes(blockNumber)) {
          claimedBlocks.push(blockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        }
        return;
      }

      document.querySelectorAll(".block").forEach((b) => b.classList.remove("selected"));
      block.classList.add("selected");
      selectedBlockNumber = blockNumber;

      modal.classList.remove("hidden");

      document.getElementById("blockNumber").value = selectedBlockNumber;
      document.getElementById("selected-block-text").textContent =
        `Selected Block: #${selectedBlockNumber}`;
    });
  });

  // === MODAL CLOSE ==========================================================
  if (closeButton) {
    closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  // === PAYPAL + UPLOAD LOGIC ================================================
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  function canCheckout() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const file = document.getElementById("fileUpload").files.length > 0;
    return name && email && file && selectedBlockNumber;
  }

  // ==== 2MB FILE SIZE VALIDATION ============================================
  function validateFileSize() {
    const fileInput = document.getElementById("fileUpload");
    const file = fileInput.files[0];

    if (!file) return false;

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      alert("❌ Your file is larger than 2 MB. Please upload a smaller file.");
      fileInput.value = "";
      return false;
    }
    return true;
  }

  // Show/hide PayPal button depending on form completeness + size
  function updateGate() {
    // Validate file size first
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

  // === Render PayPal Button ==================================================
  function renderPayPalButton() {
    paypalContainer.innerHTML = ""; // prevent duplicates

    (async () => {
      // Final safety check: has this block been claimed before rendering buttons?
      const alreadyClaimed = await isBlockClaimedRemote(selectedBlockNumber);
      if (alreadyClaimed) {
        alert("⚠️ This block has just been claimed. Please choose a different block.");
        modal.classList.add("hidden");

        const selectedBlock = document.querySelector(".block.selected");
        if (selectedBlock) {
          selectedBlock.classList.remove("selected");
          selectedBlock.classList.add("claimed");
          selectedBlock.style.cursor = "not-allowed";
        }

        if (!claimedBlocks.includes(selectedBlockNumber)) {
          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        }

        return;
      }

      paypal.Buttons({
        style: { color: "gold", shape: "pill", label: "pay", height: 45 },

        createOrder: (data, actions) => {
          const label = selectedBlockNumber
            ? `Vault of Time Block #${selectedBlockNumber}`
            : "Vault of Time Block";

          return actions.order.create({
            purchase_units: [
              { description: label, amount: { value: blockPrice.toFixed(2) } }
            ]
          });
        },

        onApprove: (data, actions) => {
          return actions.order.capture().then(async (details) => {
            alert(`✅ Payment completed by ${details.payer.name.given_name}.
Your Block #${selectedBlockNumber} is now reserved.`);

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();

            // Save to Firestore
            await saveBlockToFirestore(selectedBlockNumber, name, email);

            // Update local cache + UI
            if (!claimedBlocks.includes(selectedBlockNumber)) {
              claimedBlocks.push(selectedBlockNumber);
              localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
            }

            const selectedBlock = document.querySelector(".block.selected");
            if (selectedBlock) {
              selectedBlock.classList.remove("selected");
              selectedBlock.classList.add("claimed");
              selectedBlock.style.cursor = "not-allowed";
            }

            modal.classList.add("hidden");

            // Generate PDF certificate
            generateCertificatePDF(name, selectedBlockNumber);
          });
        },

        onCancel: () => alert("❌ Transaction cancelled."),
        onError: (err) => {
          console.error(err);
          alert("Payment error. Please try again.");
        }

      }).render("#paypal-button-container");
    })();
  }

  // === EVENT LISTENERS =======================================================
  ["input", "change"].forEach(evt => {
    form.addEventListener(evt, updateGate, true);
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", updateGate);
  }

  // === MENU LOGIC ============================================================
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  if (menuToggle && sideMenu && closeMenu && overlay) {
    menuToggle.addEventListener("click", () => {
      sideMenu.classList.add("open");
      overlay.classList.add("show");
      menuToggle.classList.add("active");
    });

    closeMenu.addEventListener("click", () => {
      sideMenu.classList.remove("open");
      overlay.classList.remove("show");
      menuToggle.classList.remove("active");
    });

    overlay.addEventListener("click", () => {
      sideMenu.classList.remove("open");
      overlay.classList.remove("show");
      menuToggle.classList.remove("active");
    });
  }

  // === ACCORDION LOGIC =======================================================
  function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    if (!headers.length) return;

    headers.forEach(header => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const isOpen = content.classList.contains("show");

        document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
        document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));

        if (!isOpen) {
          content.classList.add("show");
          header.classList.add("active");
        }
      };
    });
  }
  setTimeout(initAccordion, 300);

  // === CERTIFICATE GENERATOR ================================================
  function generateCertificatePDF(name, blockNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Border
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(6);
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60);

    // Title
    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.text("Vault Of Time Certificate of Ownership", pageWidth / 2, 120, { align: "center" });

    // Body
    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("This certifies that", pageWidth / 2, 200, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(26);
    doc.text(name, pageWidth / 2, 240, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text(`is the rightful guardian of Block #${blockNumber}`, pageWidth / 2, 280, { align: "center" });
    doc.text("Sealed within The Vault until 2050.", pageWidth / 2, 310, { align: "center" });

    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, pageWidth / 2, 360, { align: "center" });

    doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
  }

  // === NOTICE BANNER LOGIC ===================================================
  const banner = document.getElementById("rulesBanner");
  const ackBtn = document.getElementById("ackRulesBtn");
  const openHowToBtn = document.getElementById("openHowTo");
  const openRulesBtn = document.getElementById("openRules");

  if (banner && !localStorage.getItem("vaultRulesAcknowledged")) {
    banner.classList.remove("hidden");
  }

  if (ackBtn) {
    ackBtn.addEventListener("click", () => {
      banner.classList.add("hidden");
      localStorage.setItem("vaultRulesAcknowledged", "true");
    });
  }

  function openAccordionByText(text) {
    document.querySelectorAll(".accordion-header").forEach(header => {
      if (header.textContent.includes(text)) {
        const content = header.nextElementSibling;
        content.classList.add("show");
        header.classList.add("active");
        sideMenu.classList.add("open");
        overlay.classList.add("show");
      }
    });
  }

  if (openHowToBtn) {
    openHowToBtn.addEventListener("click", () => openAccordionByText("How To Buy"));
  }

  if (openRulesBtn) {
    openRulesBtn.addEventListener("click", () => openAccordionByText("Vault Rules"));
  }
});
