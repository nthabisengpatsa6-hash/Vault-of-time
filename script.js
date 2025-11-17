console.log("Vault JS active");
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
    // fall back to whatever is in localStorage
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
  // Core DOM elements
  const blockForm = document.getElementById("blockForm");
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");
  const viewClose = document.querySelector(".close-view");
  const closeBtn = document.querySelector(".close-button");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const readyMsg = document.getElementById("ready-message");
  const payButton = document.getElementById("payButton");

  // Menu + overlay
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

  let selected = null;

  // Restore claimed from localStorage first
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  // Then try to load from Firestore (will overwrite claimed if successful)
  await loadClaimedBlocks();

  // === GRID ========================================
  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;
      // Remove skeletons once real blocks render
document.querySelectorAll(".loading-block").forEach(el => el.remove());

      if (claimed.includes(i)) {
        div.classList.add("claimed");
      }

      div.onclick = async () => {
        if (claimed.includes(i)) {
          const data = await fetchBlock(i);
          const titleEl = document.getElementById("viewBlockTitle");
          const msgEl = document.getElementById("viewBlockMessage");
          const mediaEl = document.getElementById("viewBlockMedia");

          if (titleEl) titleEl.textContent = `Block #${i}`;
          if (msgEl) msgEl.textContent = data?.message || "";
          if (mediaEl) mediaEl.innerHTML = "";
          if (viewModal) viewModal.classList.remove("hidden");
          return;
        }

        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        div.classList.add("selected");

        selected = i;
        const blockNumberInput = document.getElementById("blockNumber");
        const selectedText = document.getElementById("selected-block-text");

        if (blockNumberInput) blockNumberInput.value = i;
        if (selectedText) selectedText.textContent = `Selected Block: #${i}`;
        if (modal) modal.classList.remove("hidden");
      };

      grid.appendChild(div);
    }
  }

  renderGrid();

  // === CLOSE MODALS =================================
  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.add("hidden");
  }
  if (viewClose && viewModal) {
    viewClose.onclick = () => viewModal.classList.add("hidden");
  }

  // === SIDE MENU TOGGLE =============================
  function closeMenu() {
    if (sideMenu) sideMenu.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
    if (menuToggle) menuToggle.classList.remove("active");
  }

  if (menuToggle && sideMenu && overlay) {
    menuToggle.addEventListener("click", () => {
      sideMenu.classList.add("open");
      overlay.classList.add("show");
      menuToggle.classList.add("active");
    });
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener("click", closeMenu);
  }

  if (overlay) {
    overlay.addEventListener("click", closeMenu);
  }

  // === ACCORDION (MATCHES YOUR CSS) =================
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = header.classList.contains("active");

      // Close all
      document.querySelectorAll(".accordion-header").forEach(h => {
        h.classList.remove("active");
        const c = h.nextElementSibling;
        if (c && c.classList) c.classList.remove("show");
      });

      // Re-open if it was closed
      if (!isOpen && content && content.classList) {
        header.classList.add("active");
        content.classList.add("show");
      }
    });
  });

  // === VALIDATION ===================================
  function valid() {
    return (
      nameInput &&
      emailInput &&
      fileInput &&
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  function updateGate() {
    if (!readyMsg || !payButton) return;
    if (valid()) {
      readyMsg.classList.add("show");
      payButton.style.display = "block";
    }
  }

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) {
    uploadBtn.onclick = updateGate;
  }
  if (blockForm) {
    blockForm.addEventListener("input", updateGate, true);
  }

  // === TEMP PAYMENT (NO PAYPAL WHILE WE STABILISE) ==
  if (payButton) {
    payButton.onclick = async () => {
      if (!selected) {
        alert("Please select a block first.");
        return;
      }

      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        alert("Please fill in your name and email.");
        return;
      }

      alert("🟡 Payment system is being upgraded.\nYour block will be reserved now.");

      await saveBlock(
        selected,
        nameInput.value,
        emailInput.value,
        messageInput.value
      );

      claimed.push(selected);
      localStorage.setItem("claimed", JSON.stringify(claimed));

      if (modal) modal.classList.add("hidden");
      renderGrid();
    };
  }
});

// === LOADER – SIMPLE & ROBUST =======================
window.addEventListener("load", () => {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  if (!loader || !main) return;

  // Show loader briefly, then reveal main content
  setTimeout(() => {
    loader.classList.add("vault-loader-hide");
    main.classList.add("vault-main-visible");

    setTimeout(() => {
      loader.remove();
    }, 600);
  }, 1500);
});
