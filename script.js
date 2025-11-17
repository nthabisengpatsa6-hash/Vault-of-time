alert("Vault script is running!");
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

// === FIREBASE CONFIG =================================
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

let claimedBlocks = [];

// === FIRESTORE HELPERS ===============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    console.error("Error loading:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function saveBlock(blockNumber, name, email, message) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      message: message || null,
      purchasedAt: serverTimestamp()
    });
  } catch (err) {}
}

async function fetchBlock(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// === MAIN APP ========================================
document.addEventListener("DOMContentLoaded", async () => {

  // === LOADING OVERLAY ===============================
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

  // === DOM REFS ======================================
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const closeBtn = document.querySelector(".close-button");
  const viewClose = document.querySelector(".close-view");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const viewBlockTitle = document.getElementById("viewBlockTitle");
  const viewBlockMessage = document.getElementById("viewBlockMessage");

  const paypalContainer = document.getElementById("paypal-button-container");
  const readyMsg = document.getElementById("ready-message");

  let selected = null;
  let paypalRendered = false;
  const blockPrice = 6.0;

  // === FIRESTORE LOAD ================================
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocks();

  // === GRID ==========================================
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;
      if (claimedBlocks.includes(i)) {
        div.classList.add("claimed");
      }
      grid.appendChild(div);
    }
  }
  buildGrid();

  function refreshGrid() {
    document.querySelectorAll(".block").forEach(b => {
      const num = Number(b.textContent);
      if (claimedBlocks.includes(num)) {
        b.classList.add("claimed");
        b.classList.remove("selected");
      }
    });
  }

  // === BLOCK CLICK ==================================
  grid.addEventListener("click", async e => {
    if (!e.target.classList.contains("block")) return;
    const num = Number(e.target.textContent);

    if (claimedBlocks.includes(num)) {
      const data = await fetchBlock(num);
      viewBlockTitle.textContent = `Block #${num}`;
      viewBlockMessage.textContent = data?.message || "(no message)";
      viewModal.classList.remove("hidden");
      return;
    }

    document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
    e.target.classList.add("selected");
    selected = num;

    document.getElementById("blockNumber").value = num;
    document.getElementById("selected-block-text").textContent = `Selected Block: #${num}`;
    modal.classList.remove("hidden");
  });

  // === MODAL CLOSE ===================================
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === FORM VALIDATION ===============================
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  function fileOK() {
    const f = fileInput.files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("File too large (2MB max).");
      return false;
    }
    return true;
  }

  function updateGate() {
    if (!fileOK()) return;
    if (valid()) {
      readyMsg.classList.add("show");
      if (!paypalRendered) {
        paypalRendered = true;
        renderPayPal();
      }
      paypalContainer.classList.add("show");
    }
  }

  document.getElementById("uploadBtn").onclick = updateGate;
  form.addEventListener("input", updateGate, true);

  // === PAYPAL BUTTON (NEW TAB MODE) ==================
  function renderPayPal() {
    paypal.Buttons({
      style: { shape: "pill", color: "gold", layout: "horizontal" },

      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            description: `Vault Block #${selected}`,
            amount: { value: blockPrice.toFixed(2) }
          }],
          application_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: window.location.href,
            cancel_url: window.location.href
          }
        });
      },

      onApprove: async (data, actions) => {
        const details = await actions.order.capture();
        await paymentSuccess(details);
      },

      onClick: () => {
        // forces PayPal to open in a new tab
        window.open("about:blank");
      },

      onError: err => {
        console.error(err);
        alert("Payment failed — try again.");
      }
    }).render("#paypal-button-container");
  }

  // === PAYMENT SUCCESS ===============================
  async function paymentSuccess(details) {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const msg = messageInput.value.trim();

    await saveBlock(selected, name, email, msg);
    claimedBlocks.push(selected);
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

    modal.classList.add("hidden");
    refreshGrid();
  }

  // === ACCORDION =====================================
  document.querySelectorAll(".accordion-header").forEach(h => {
    h.addEventListener("click", () => {
      const open = h.classList.contains("active");
      document.querySelectorAll(".accordion-header").forEach(a => a.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(a => a.classList.remove("show"));
      if (!open) {
        h.classList.add("active");
        h.nextElementSibling.classList.add("show");
      }
    });
  });

  // === MENU ==========================================
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
