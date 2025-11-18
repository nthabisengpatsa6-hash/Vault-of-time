console.log("Vault JS running");

// === FIREBASE IMPORTS =================================
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

// === GRID CONFIG ====================================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
let currentPage = 1;

// === LOAD CLAIMED BLOCKS ============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch {
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// === SAVE BLOCK =====================================
async function saveBlock(pending) {
  await setDoc(doc(blocksCollection, String(pending.blockNumber)), {
    name: pending.name,
    email: pending.email,
    message: pending.message || "",
    purchasedAt: serverTimestamp()
  });
}

// === FETCH BLOCK ====================================
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

// === MAIN ===========================================
document.addEventListener("DOMContentLoaded", async () => {

  // DOM HOOKS
  const grid = document.getElementById("grid");
  const pagination = document.getElementById("pagination");

  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const closeBtn = document.querySelector(".close-button");
  const viewClose = document.querySelector(".close-view");
  const readyMsg = document.getElementById("ready-message");
  const payButton = document.getElementById("payButton");

  const banner = document.getElementById("rules-banner");
  const ackBtn = document.getElementById("acknowledgeBtn");

  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

  const searchInput = document.getElementById("blockSearch");
  const searchBtn = document.getElementById("searchBtn");

  let selected = null;

  // Load claimed blocks
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();

  // Render page 1
  renderPage(currentPage);

  // Loader
  hideLoader();

  // RULES BANNER
  if (!localStorage.getItem("vaultRulesOk")) {
    banner.style.display = "block";
    grid.style.opacity = "0.4";
    grid.style.pointerEvents = "none";
  }

  ackBtn.onclick = () => {
    localStorage.setItem("vaultRulesOk", "true");
    banner.style.display = "none";
    grid.style.opacity = "1";
    grid.style.pointerEvents = "auto";
  };

  // === PAGINATION CONTROLS ==========================
  function renderPagination() {
    const totalPages = Math.ceil(TOTAL_BLOCKS / PAGE_SIZE);
    pagination.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "← Prev";
    prev.disabled = currentPage === 1;
    prev.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prev);

    const pageInfo = document.createElement("span");
    pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    pagination.appendChild(pageInfo);

    const next = document.createElement("button");
    next.textContent = "Next →";
    next.disabled = currentPage === totalPages;
    next.onclick = () => changePage(currentPage + 1);
    pagination.appendChild(next);
  }

  function changePage(page) {
    currentPage = page;
    renderPage(page);
  }

  // === RENDER PAGE FUNCTION ========================
  function renderPage(pageNum) {
    grid.innerHTML = "";

    const start = (pageNum - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

    for (let i = start; i <= end; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;
      div.style.position = "relative"; // required for highlight glow

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

    renderPagination();
  }

  // === SEARCH ================================
  function searchBlock() {
    const target = Number(searchInput.value);
    if (!target || target < 1 || target > TOTAL_BLOCKS) return;

    const newPage = Math.ceil(target / PAGE_SIZE);
    const wasDifferentPage = newPage !== currentPage;

    currentPage = newPage;
    renderPage(newPage);

    setTimeout(() => {
      const blockEl = [...document.querySelectorAll(".block")]
        .find(b => Number(b.textContent) === target);

      if (!blockEl) return;

      blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
      blockEl.classList.add("search-highlight");

      setTimeout(() => {
        blockEl.classList.remove("search-highlight");
      }, 1500);
    }, wasDifferentPage ? 100 : 10);
  }

  if (searchBtn) searchBtn.addEventListener("click", searchBlock);
  if (searchInput) searchInput.addEventListener("change", searchBlock);

  // === MODALS ==================================
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === MENU ====================================
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

  // === ACCORDION (RESTORED) ====================
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const open = header.classList.contains("active");

      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));

      if (!open) {
        header.classList.add("active");
        content.classList.add("show");
      }
    });
  });

  // === CLAIM VALIDATION ========================
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

  // === TEMP "PAY" BUTTON ======================
  payButton.onclick = async () => {
    if (!valid()) return alert("Complete all fields first.");

    const pending = {
      blockNumber: selected,
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value
    };

    await saveBlock(pending);

    claimed.push(selected);
    localStorage.setItem("claimed", JSON.stringify(claimed));

    modal.classList.add("hidden");
    renderPage(currentPage);
  };
});

// === LOADER ==================================
function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  setTimeout(() => {
    if (loader) {
      loader.style.opacity = 0;
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 400);
    }
    if (main) main.classList.add("vault-main-visible");
  }, 1400);
                 }
