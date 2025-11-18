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

// === GET CLAIMED BLOCKS =============================
async function loadClaimed() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch (err) {
    console.error("Error loading claimed blocks:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// === SAVE BLOCK TO FIRESTORE ========================
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

// === GET SPECIFIC BLOCK =============================
async function fetchBlock(num) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(num)));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Error fetching block:", err);
    return null;
  }
}

// === READ URL PARAM ================================
function getParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// === MAIN APP ======================================
document.addEventListener("DOMContentLoaded", async () => {

  // 🔗 UI ELEMENTS
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const closeBtn = document.querySelector(".close-button");
  const viewClose = document.querySelector(".close-view");

  const blockForm = document.getElementById("blockForm");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const readyMsg = document.getElementById("ready-message");
  const payButton = document.getElementById("payButton");

  let selected = null;

  // 💾 Load claimed blocks
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimed();

  // === BUILD GRID ===================================
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

  // === CLOSE MODALS =================================
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === SIDE MENU ====================================
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

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

  // === ACCORDION ====================================
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

  // === VALIDATION ===================================
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
  blockForm.addEventListener("input", updateGate, true);

  // === TEMP — NO PAYPAL YET =========================
  payButton.onclick = async () => {
    if (!valid()) return alert("Please complete all fields");

    const pending = {
      blockNumber: selected,
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value
    };

    await saveBlock(pending);
    claimed.push(pending.blockNumber);
    localStorage.setItem("claimed", JSON.stringify(claimed));

    modal.classList.add("hidden");
    renderGrid();
  };
});

// === LOADER =========================================
window.addEventListener("load", () => {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  if (!loader || !main) return;

  // Show loader at least 2.2s
  setTimeout(() => {
    loader.classList.add("vault-loader-hide");
    main.classList.add("vault-main-visible");

    setTimeout(() => loader.remove(), 700);
  }, 2200);
});
