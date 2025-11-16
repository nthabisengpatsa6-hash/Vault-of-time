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

// Expose Firestore globally
window.db = db;

// Firestore "blocks" collection
const blocksCollection = collection(db, "blocks");

// Memory cache
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);
    claimedBlocks = snapshot.docs.map((d) => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    console.log("Loaded claimed:", claimedBlocks);
  } catch (err) {
    console.error("Error loading Firestore:", err);
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

async function saveBlockToFirestore(blockNumber, name, email, message) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      message: message || null,
      purchasedAt: serverTimestamp()
    });
    console.log("Saved block:", blockNumber);
  } catch (err) {
    console.error("Failed saving:", err);
  }
}

// ============================================================================
// APP START
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Vault script loaded.");

  // ------------------------------------------------------------------------
  // LOADING OVERLAY
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
    fontFamily: "system-ui",
    transition: "opacity .4s ease"
  });
  loadingOverlay.innerHTML = `
    <div style="font-size:42px;margin-bottom:10px;">🕰️</div>
    <div style="font-size:20px;font-weight:600;margin-bottom:4px;">The Vault is opening…</div>
    <div style="font-size:14px;opacity:0.8;">Fetching sealed blocks and preparing your grid.</div>
  `;
  document.body.appendChild(loadingOverlay);

  const hideLoadingOverlay = () => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => loadingOverlay.remove(), 400);
  };

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
  // SEED FROM LOCAL FIRST
  // ------------------------------------------------------------------------
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // ------------------------------------------------------------------------
  // BUILD GRID
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

    if (!document.getElementById("founders-message")) {
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

  buildGrid();

  // ------------------------------------------------------------------------
  // UPDATE GRID CLAIMED STATE
  // ------------------------------------------------------------------------
  function applyClaimedStylingToGrid() {
    document.querySelectorAll(".block").forEach((block) => {
      const num = Number(block.textContent);
      if (claimedBlocks.includes(num)) {
        block.classList.add("claimed");
        block.classList.remove("selected");
        block.style.cursor = "not-allowed";
      }
    });
  }

  // ------------------------------------------------------------------------
  // BLOCK CLICK HANDLERS
  // ------------------------------------------------------------------------
  function attachBlockClickHandlers() {
    document.querySelectorAll(".block").forEach((block) => {
      block.addEventListener("click", () => {
        const blockNumber = Number(block.textContent);
        if (!blockNumber) return;
        if (blockNumber === founderBlock || claimedBlocks.includes(blockNumber)) return;

        document.querySelectorAll(".block").forEach((b) => b.classList.remove("selected"));
        block.classList.add("selected");

        selectedBlockNumber = blockNumber;

        modal.classList.remove("hidden");
        document.getElementById("blockNumber").value = blockNumber;
        document.getElementById("selected-block-text").textContent =
          `Selected Block: #${blockNumber}`;
      });
    });
  }

  attachBlockClickHandlers();

  // ------------------------------------------------------------------------
  // FETCH LATEST FROM FIRESTORE
  // ------------------------------------------------------------------------
  await loadClaimedBlocksFromFirestore();
  applyClaimedStylingToGrid();
  hideLoadingOverlay();

  // ========================================================================
  // MODAL CLOSE
  // ========================================================================
  closeButton?.addEventListener("click", () => modal.classList.add("hidden"));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // ========================================================================
  // PAYPAL + VALIDATION (NO DUPES)
  // ========================================================================
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  let paypalRendered = false;

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
      alert("❌ Your file is larger than 2MB.");
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

      if (!paypalRendered) {
        paypalRendered = true;
        renderPayPalButton();
      }

      paypalContainer.classList.add("show");
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  saveBtn?.addEventListener("click", updateGate);
  form?.addEventListener("input", updateGate, true);
  form?.addEventListener("change", updateGate, true);

  // ========================================================================
  // PAYPAL BUTTON – NOW SAVES MESSAGE TOO
  // ========================================================================
  function renderPayPalButton() {
    paypalContainer.innerHTML = "";

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

      onApprove: async (data, actions) => {
        const details = await actions.order.capture();
        alert(`✅ Payment completed by ${details.payer.name.given_name}.`);

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();

        await saveBlockToFirestore(selectedBlockNumber, name, email, message);

        if (!claimedBlocks.includes(selectedBlockNumber)) {
          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        }

        applyClaimedStylingToGrid();
        modal.classList.add("hidden");
      },

      onCancel: () => alert("❌ Transaction cancelled."),
      onError: (err) => {
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
    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const open = content.classList.contains("show");

        document.querySelectorAll(".accordion-content").forEach((c) =>
          c.classList.remove("show")
        );
        document.querySelectorAll(".accordion-header").forEach((h) =>
          h.classList.remove("active")
        );

        if (!open) {
          content.classList.add("show");
          header.classList.add("active");
        }
      };
    });
  }
  setTimeout(initAccordion, 200);
});
