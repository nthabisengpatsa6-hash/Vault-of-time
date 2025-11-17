console.log("Vault JS running");

// === FIREBASE IMPORTS ================================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

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

let claimed = [];

// === LOAD CLAIMED BLOCKS =============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch (err) {
    console.error("Error loading claimed blocks:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// === SAVE BLOCK ======================================
async function saveBlock(pending) {
  try {
    await setDoc(doc(blocksCollection, String(pending.blockNumber)), {
      name: pending.name,
      email: pending.email,
      message: pending.message || "",
      purchasedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving block:", err);
  }
}

// === FETCH BLOCK =====================================
async function fetchBlock(num) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(num)));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Error fetching block:", err);
    return null;
  }
}

// === HELPER: URL PARAM ===============================
function getParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// === MAIN APP ========================================
document.addEventListener("DOMContentLoaded", async () => {
  
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
  const payButton = document.getElementById("payButton");

  // === MENU ELEMENTS ===
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

  let selected = null;

  // Load claimed blocks
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();

  // === GRID ========================================
  function renderGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;

      if (claimed.includes(i)) {
        div.classList.add("claimed");
      }

      div.onclick = async () => {
        if (claimed.includes(i)) {
          const data = await fetchBlock(i);
          document.getElementById("viewBlockTitle").textContent = `Block #${i}`;
          document.getElementById("viewBlockMessage").textContent = data?.message || "";
          document.getElementById("viewBlockMedia").innerHTML = "";
          viewModal.classList.remove("hidden");
          return;
        }

        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        div.classList.add("selected");

        selected = i;
        document.getElementById("blockNumber").value = i;
        document.getElementById("selected-block-text").textContent = `Selected Block: #${i}`;
        modal.classList.remove("hidden");
      };

      grid.appendChild(div);
    }
  }

  renderGrid();

  // === RULES ACKNOWLEDGEMENT ==========================
  const banner = document.getElementById("rules-banner");
  const ackBtn = document.getElementById("acknowledgeBtn");

  if (!localStorage.getItem("vaultRulesOk")) {
    banner.style.display = "block";
    grid.style.opacity = "0.3";
    grid.style.pointerEvents = "none";
  }

  ackBtn.onclick = () => {
    localStorage.setItem("vaultRulesOk", "true");
    banner.style.display = "none";
    grid.style.opacity = "1";
    grid.style.pointerEvents = "auto";
  };

  // CLOSE MODALS
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === MENU ===
  function closeMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
    menuToggle.classList.remove("active");
  }

  menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
    menuToggle.classList.add("active");
  });

  closeMenuBtn.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  // ACCORDION
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = header.classList.contains("active");

      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));

      if (!isOpen) {
        header.classList.add("active");
        content.classList.add("show");
      }
    });
  });

  // VALIDATION
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  function updateGate() {
    if (valid()) {
      readyMsg.classList.add("show");
      payButton.style.display = "block";
    }
  }

  document.getElementById("uploadBtn").onclick = updateGate;
  document.getElementById("blockForm").addEventListener("input", updateGate, true);

  // === PAY BUTTON =================================
  payButton.onclick = () => {
    if (!valid()) return alert("Complete all fields first.");

    const pending = {
      blockNumber: selected,
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value
    };

    localStorage.setItem("pendingBlock", JSON.stringify(pending));

    window.open(
      "https://www.sandbox.paypal.com/ncp/payment/L4UK67HLWZ324",
      "_blank"
    );
  };

  // === PAYMENT RETURN LOGIC ========================
  if (getParam("paid") === "true") {
    const pending = JSON.parse(localStorage.getItem("pendingBlock") || "{}");

    if (pending.blockNumber) {
      await saveBlock(pending);
      claimed.push(pending.blockNumber);
      localStorage.setItem("claimed", JSON.stringify(claimed));
      localStorage.removeItem("pendingBlock");

      alert(`Block #${pending.blockNumber} has been sealed in the Vault.`);

      window.location = "https://vaultoftime.com";
    }
  }
});

// === LOADER ==========================================
window.addEventListener("load", () => {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  if (!loader || !main) return;

  setTimeout(() => {
    loader.classList.add("vault-loader-hide");
    main.classList.add("vault-main-visible");

    setTimeout(() => loader.remove(), 600);
  }, 1200);
});
