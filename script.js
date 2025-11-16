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
const blocksCollection = collection(db, "blocks");

// Memory cache
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    console.error("Firestore load error:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function fetchBlockData(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Block fetch error:", err);
    return null;
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
  } catch (err) {
    console.error("Failed to save block:", err);
  }
}

// ============================================================================
// APP START
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {

  // LOADING OVERLAY
  const loadingOverlay = document.createElement("div");
  Object.assign(loadingOverlay.style, {
    position: "fixed",
    inset: "0",
    background: "radial-gradient(circle, #141922 0%, #05070b 55%, #020308 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    color: "#f9d26e",
    zIndex: 9999,
    transition: "opacity .4s"
  });
  loadingOverlay.innerHTML = `
    <div style="font-size:42px;">🕰️</div>
    <div style="margin-top:5px;">Opening the Vault...</div>
  `;
  document.body.appendChild(loadingOverlay);

  const hideOverlay = () => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => loadingOverlay.remove(), 400);
  };

  // DOM refs
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");
  const messageInput = document.getElementById("message");
  const viewModal = document.getElementById("viewModal");
  const viewClose = document.querySelector(".close-view");
  const viewBlockTitle = document.getElementById("viewBlockTitle");
  const viewBlockMessage = document.getElementById("viewBlockMessage");
  const viewBlockMeta = document.getElementById("viewBlockMeta");
  const viewBlockMedia = document.getElementById("viewBlockMedia");

  const paypalContainer = document.getElementById("paypal-button-container");
  const readyMsg = document.getElementById("ready-message");
  const uploadBtn = document.getElementById("uploadBtn");

  let selectedBlockNumber = null;
  let paypalRendered = false;
  const blockPrice = 6.0;

  // Load claimed blocks
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocksFromFirestore();

  // GRID — 1 to 100 only
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const block = document.createElement("div");
      block.classList.add("block");
      block.textContent = i;

      if (claimedBlocks.includes(i)) {
        block.classList.add("claimed");
        block.style.cursor = "not-allowed";
      }
      grid.appendChild(block);
    }
  }
  buildGrid();

  // Ensure styling updates
  function styleClaimed() {
    document.querySelectorAll(".block").forEach(b => {
      const num = Number(b.textContent);
      if (claimedBlocks.includes(num)) {
        b.classList.add("claimed");
        b.classList.remove("selected");
      }
    });
  }
  styleClaimed();

  // Block interactions
  function attachBlockHandlers() {
    document.querySelectorAll(".block").forEach(block => {
      block.addEventListener("click", async () => {
        const num = Number(block.textContent);
        if (!num) return;

        // Claimed: view mode
        if (claimedBlocks.includes(num)) {
          const data = await fetchBlockData(num);

          viewBlockTitle.textContent = `Block #${num}`;
          viewBlockMedia.innerHTML = "";
          viewBlockMessage.textContent = data?.message || "(no message)";
          viewBlockMeta.textContent = data?.name ? `Claimed by ${data.name}` : "";
          viewModal.classList.remove("hidden");
          return;
        }

        // Free: claim mode
        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        block.classList.add("selected");

        selectedBlockNumber = num;
        document.getElementById("blockNumber").value = num;
        document.getElementById("selected-block-text").textContent = `Selected Block: #${num}`;

        modal.classList.remove("hidden");
      });
    });
  }
  attachBlockHandlers();

  // Close modals
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.add("hidden");
  });
  viewClose.addEventListener("click", () => viewModal.classList.add("hidden"));
  viewModal.addEventListener("click", e => {
    if (e.target === viewModal) viewModal.classList.add("hidden");
  });

  // File validation
  function validateFileSize() {
    const f = document.getElementById("fileUpload").files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("That file is too large (2MB max).");
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

  // Show PayPal when ready
  function updateGate() {
    if (!validateFileSize()) {
      readyMsg.classList.remove("show");
      return;
    }
    if (canCheckout()) {
      readyMsg.classList.add("show");

      if (!paypalRendered && window.paypal) {
        paypalRendered = true;
        window.paypal.Buttons({
          style: {
            shape: "pill",
            color: "gold",
            label: "pay",
            layout: "vertical"
          },
          createOrder: (data, actions) => {
            return actions.order.create({
              purchase_units: [
                {
                  description: `Vault Block #${selectedBlockNumber}`,
                  amount: { value: blockPrice.toFixed(2) }
                }
              ]
            });
          },
          onApprove: async (data, actions) => {
            const details = await actions.order.capture();
            await paymentSuccess(details);
          },
          onError: err => {
            console.error(err);
            alert("Payment problem. Please try again.");
          }
        }).render("#paypal-button-container");
      }

      paypalContainer.classList.add("show");
    }
  }

  uploadBtn.addEventListener("click", updateGate);
  form.addEventListener("input", updateGate, true);
  form.addEventListener("change", updateGate, true);

  // Successful payment
  async function paymentSuccess(details) {
    alert(`🪙 Block purchased by ${details.payer.name.given_name}!`);

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = messageInput.value.trim() || null;

    await saveBlockToFirestore(selectedBlockNumber, name, email, message);
    claimedBlocks.push(selectedBlockNumber);
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

    styleClaimed();
    modal.classList.add("hidden");
  }

  // Accordion restore
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const open = header.classList.contains("active");
      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
      if (!open) {
        header.classList.add("active");
        header.nextElementSibling.classList.add("show");
      }
    });
  });

  // Menu works
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  });
  closeMenu.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });
  overlay.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });

  hideOverlay();
});
