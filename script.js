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

// Expose Firestore globally (prevents weird module errors if needed elsewhere)
window.db = db;

// Collection reference
const blocksCollection = collection(db, "blocks");

// Memory cache for claimed blocks
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

// Load the list of claimed blocks (doc IDs) – single read on startup
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);
    claimedBlocks = snapshot.docs.map(docSnap => Number(docSnap.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    console.log("Loaded claimed blocks from Firestore:", claimedBlocks);
  } catch (err) {
    console.error("Firestore error, falling back to local copy:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

// Remote check used ONLY at checkout as a final safety net
async function isBlockClaimedRemote(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    return snap.exists();
  } catch (err) {
    console.error("Error checking Firestore:", err);
    return claimedBlocks.includes(blockNumber);
  }
}

// Save a newly purchased block
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

  // ------------------------------------------------------------------------
  // "The Vault is opening…" Loading overlay
  // ------------------------------------------------------------------------
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
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: "opacity 0.4s ease"
  });
  loadingOverlay.innerHTML = `
    <div style="font-size:42px;margin-bottom:10px;">🕰️</div>
    <div style="font-size:20px;font-weight:600;margin-bottom:4px;">
      The Vault is opening…
    </div>
    <div style="font-size:14px;opacity:0.8;">
      Fetching sealed blocks and preparing your grid.
    </div>
  `;
  document.body.appendChild(loadingOverlay);

  function hideLoadingOverlay() {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.parentNode) {
        loadingOverlay.parentNode.removeChild(loadingOverlay);
      }
    }, 400);
  }

  // ------------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------------
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  const visibleRange = [1, 100];
  const founderBlock = 1;
  const blockPrice = 6.0;

  let selectedBlockNumber = null;

  // ------------------------------------------------------------------------
  // 1) Seed claimedBlocks from localStorage so grid can render instantly
  // ------------------------------------------------------------------------
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // ------------------------------------------------------------------------
  // GRID GENERATION (using whatever claimedBlocks we have right now)
  // ------------------------------------------------------------------------
  function buildGrid() {
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

    const existingMsg = document.getElementById("founders-message");
    if (!existingMsg) {
      const msg = document.createElement("p");
      msg.id = "founders-message";
      msg.style.textAlign = "center";
      msg.style.color = "#d4af37";
      msg.style.marginTop = "1rem";
      msg.style.fontWeight = "600";
      msg.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}).`;
      grid.insertAdjacentElement("afterend", msg);
    }
  }

  buildGrid(); // render immediately

  // ------------------------------------------------------------------------
  // Helper to re-apply claimed styling after we get fresh data from Firestore
  // ------------------------------------------------------------------------
  function applyClaimedStylingToGrid() {
    const blocks = document.querySelectorAll(".block");
    blocks.forEach((block) => {
      const num = Number(block.textContent);
      if (claimedBlocks.includes(num)) {
        block.classList.add("claimed");
        block.classList.remove("selected");
        block.style.cursor = "not-allowed";
      }
    });
  }

  // ------------------------------------------------------------------------
  // BLOCK CLICK – now purely local (no Firestore call, so instant)
  // ------------------------------------------------------------------------
  function attachBlockClickHandlers() {
    const blocks = document.querySelectorAll(".block");

    blocks.forEach((block) => {
      block.addEventListener("click", () => {
        const blockNumber = Number(block.textContent);
        if (!blockNumber) return;

        // Ignore founder or claimed blocks
        if (blockNumber === founderBlock || claimedBlocks.includes(blockNumber)) {
          return;
        }

        document
          .querySelectorAll(".block")
          .forEach((b) => b.classList.remove("selected"));
        block.classList.add("selected");

        selectedBlockNumber = blockNumber;
        modal.classList.remove("hidden");

        document.getElementById("blockNumber").value = blockNumber;
        document.getElementById(
          "selected-block-text"
        ).textContent = `Selected Block: #${blockNumber}`;
      });
    });
  }

  attachBlockClickHandlers();

  // ------------------------------------------------------------------------
  // 2) Now that UI is up, fetch fresh claimed blocks from Firestore once
  // ------------------------------------------------------------------------
  await loadClaimedBlocksFromFirestore();
  applyClaimedStylingToGrid();
  hideLoadingOverlay();

  // ========================================================================
  // MODAL CLOSE
  // ========================================================================
  if (closeButton) {
    closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

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
      alert("❌ Your file is larger than 2MB. Please upload a smaller file.");
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
  form?.addEventListener("change", updateGate, true);

  // ========================================================================
  // PAYPAL BUTTON – one final Firestore check here ONLY
  // ========================================================================
  function renderPayPalButton() {
    paypalContainer.innerHTML = "";

    (async () => {
      // Final remote safety check before letting user pay
      const taken = await isBlockClaimedRemote(selectedBlockNumber);
      if (taken) {
        alert(
          "⚠️ This block has just been claimed by someone else. Please choose a different block."
        );

        // Update local cache and UI
        if (!claimedBlocks.includes(selectedBlockNumber)) {
          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        }
        applyClaimedStylingToGrid();
        modal.classList.add("hidden");
        return;
      }

      paypal.Buttons({
        style: { color: "gold", shape: "pill", label: "pay", height: 45 },

        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [
              {
                description: `Vault of Time Block #${selectedBlockNumber}`,
                amount: { value: blockPrice.toFixed(2) }
              }
            ]
          });
        },

        onApprove: (data, actions) => {
          return actions.order.capture().then(async (details) => {
            alert(`✅ Payment completed by ${details.payer.name.given_name}.`);

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();

            await saveBlockToFirestore(selectedBlockNumber, name, email);

            if (!claimedBlocks.includes(selectedBlockNumber)) {
              claimedBlocks.push(selectedBlockNumber);
              localStorage.setItem(
                "claimedBlocks",
                JSON.stringify(claimedBlocks)
              );
            }

            applyClaimedStylingToGrid();
            modal.classList.add("hidden");

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
    headers.forEach((header) => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const open = content.classList.contains("show");
        document
          .querySelectorAll(".accordion-content")
          .forEach((c) => c.classList.remove("show"));
        document
          .querySelectorAll(".accordion-header")
          .forEach((h) => h.classList.remove("active"));
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
    doc.text("Vault Of Time Certificate of Ownership", W / 2, 120, {
      align: "center"
    });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("This certifies that", W / 2, 200, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(26);
    doc.text(name, W / 2, 240, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text(
      `is the rightful guardian of Block #${blockNumber}`,
      W / 2,
      280,
      { align: "center" }
    );
    doc.text("Sealed within The Vault until 2050.", W / 2, 310, {
      align: "center"
    });

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
    document.querySelectorAll(".accordion-header").forEach((header) => {
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
