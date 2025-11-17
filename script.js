console.log("Vault JS active");

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
async function saveBlock(num, name, email, msg) {
  try {
    await setDoc(doc(blocksCollection, String(num)), {
      name,
      email,
      message: msg || null,
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

// === MAIN APP ========================================
document.addEventListener("DOMContentLoaded", async () => {

  const blockForm = document.getElementById("blockForm");
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");
  const viewClose = document.querySelector(".close-view");
  const closeBtn = document.querySelector(".close-button");

  const readyMsg = document.getElementById("ready-message");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

  let selected = null;

  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();

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

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add("hidden");
  }

  if (viewClose) {
    viewClose.onclick = () => viewModal.classList.add("hidden");
  }

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

  // Accordion
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = header.classList.contains("active");

      document.querySelectorAll(".accordion-header").forEach(h => {
        h.classList.remove("active");
        h.nextElementSibling.classList.remove("show");
      });

      if (!isOpen) {
        header.classList.add("active");
        content.classList.add("show");
      }
    });
  });

  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  function updateGate() {
    const paypalDiv = document.getElementById("paypal-container-L4UK67HLWZ324");
    if (!paypalDiv) return;

    if (valid()) {
      readyMsg.classList.remove("hidden");
      paypalDiv.style.display = "block";
      showPayPalButton();
    }
  }

  document.getElementById("uploadBtn").onclick = updateGate;
  blockForm.addEventListener("input", updateGate, true);

});

// Loader
window.addEventListener("load", () => {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  setTimeout(() => {
    loader.classList.add("vault-loader-hide");
    main.classList.add("vault-main-visible");
    setTimeout(() => loader.remove(), 600);
  }, 1500);
});
