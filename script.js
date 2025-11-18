console.log("Vault JS running");

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


/* === FIREBASE CONFIG === */
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


/* === GLOBALS === */
let claimed = [];

const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 2000;
let currentPage = 1;


/* === FIREBASE LOADING === */
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch {
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

async function saveBlock(pending) {
  return setDoc(doc(blocksCollection, String(pending.blockNumber)), {
    name: pending.name,
    email: pending.email,
    message: pending.message || "",
    purchasedAt: serverTimestamp()
  });
}

async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}


/* === DOM READY === */
document.addEventListener("DOMContentLoaded", async () => {

  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const closeBtn = document.querySelector(".close-button");
  const viewClose = document.querySelector(".close-view");
  const menuToggle = document.getElementById("menuToggle");
  const searchInput = document.getElementById("blockSearch");
  const searchBtn = document.getElementById("searchBtn");
  const pagination = document.getElementById("pagination");

  const ackBtn = document.getElementById("acknowledgeBtn");
  const banner = document.getElementById("rules-banner");

  let selected = null;

  renderSkeleton();

  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();

  renderPage();
  renderPagination();
  hideLoader();

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

  
  /* === DRAW PAGE === */
  function renderPage() {
    grid.innerHTML = "";

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

    for (let i = start; i <= end; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;

      if (claimed.includes(i)) {
        div.classList.add("claimed");
      }

      div.onclick = () => handleBlockClick(i, div);
      grid.appendChild(div);
    }
  }


  /* === PAGINATION UI === */
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

  function changePage(pg) {
    currentPage = pg;
    renderPage();
    renderPagination();
    grid.scrollIntoView({ behavior: "smooth" });
  }


  /* === SEARCH HANDLER === */
  function searchBlock() {
    const target = Number(searchInput.value);
    if (!target || target < 1 || target > TOTAL_BLOCKS) return;

    const newPage = Math.ceil(target / PAGE_SIZE);
    if (newPage !== currentPage) {
      currentPage = newPage;
      renderPage();
      renderPagination();
    }

    requestAnimationFrame(() => {
      const blocks = document.querySelectorAll(".block");
      const index = (target - 1) % PAGE_SIZE;
      const block = blocks[index];
      if (!block) return;

      block.scrollIntoView({ behavior: "smooth", block: "center" });
      block.classList.add("search-highlight");

      setTimeout(() => block.classList.remove("search-highlight"), 2000);
    });
  }

  searchBtn.addEventListener("click", searchBlock);
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") searchBlock();
  });


  /* === CLICK HANDLER === */
  async function handleBlockClick(i, div) {
    if (claimed.includes(i)) {
      const data = await fetchBlock(i);
      openViewModal(i, data);
      return;
    }

    document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
    div.classList.add("selected");

    selected = i;
    openClaimModal(i);
  }


  /* === SKELETON === */
  function renderSkeleton() {
    grid.innerHTML = "";
    for (let i = 0; i < PAGE_SIZE; i++) {
      const div = document.createElement("div");
      div.className = "block skeleton-loading";
      grid.appendChild(div);
    }
  }


  /* === MODALS === */
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  function openClaimModal(i) {
    document.getElementById("blockNumber").value = i;
    document.getElementById("selected-block-text").textContent = `Selected Block: #${i}`;
    modal.classList.remove("hidden");
  }

  function openViewModal(i, data) {
    document.getElementById("viewBlockTitle").textContent = `Block #${i}`;
    document.getElementById("viewBlockMessage").textContent = data?.message || "";
    viewModal.classList.remove("hidden");
  }


  /* === LOADER === */
  function hideLoader() {
    const loader = document.getElementById("vault-loader");
    const main = document.getElementById("vault-main-content");

    setTimeout(() => {
      loader.classList.add("vault-loader-hide");
      main.classList.add("vault-main-visible");
      setTimeout(() => loader.remove(), 600);
    }, 1100);
  }

});
