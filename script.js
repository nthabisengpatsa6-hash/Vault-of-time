console.log("Vault JS loaded");

// Firebase imports
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

// Firebase config
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

// config
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
let currentPage = 1;
let claimed = [];

// Load claimed blocks
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch (err) {
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// Save block
async function saveBlock(pending) {
  await setDoc(doc(blocksCollection, String(pending.blockNumber)), {
    name: pending.name,
    email: pending.email,
    message: pending.message || "",
    purchasedAt: serverTimestamp()
  });
}

// Fetch block data
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

document.addEventListener("DOMContentLoaded", async () => {

  // DOM refs
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
  const paypalWrapper = document.getElementById("paypalWrapper");
  const saveBtn = document.getElementById("uploadBtn");

  const banner = document.getElementById("rules-banner");
  const ackBtn = document.getElementById("acknowledgeBtn");

  const searchInput = document.getElementById("blockSearch");
  const searchBtn = document.getElementById("searchBtn");

  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenuBtn = document.getElementById("closeMenu");

  let selected = null;

  // Accordion
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const alreadyActive = header.classList.contains("active");
      
      // Reset all
      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));

      // Toggle target
      if (!alreadyActive) {
        header.classList.add("active");
        header.nextElementSibling.classList.add("show");
      }
    });
  });

  // Load saved state
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();

  renderPage(currentPage);

  hideLoader();

  // RULES LOCK
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

  // MENU
  menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  });

  overlay.addEventListener("click", closeMenu);
  closeMenuBtn.addEventListener("click", closeMenu);

  function closeMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  }

  // Pagination
  function renderPagination() {
    const totalPages = Math.ceil(TOTAL_BLOCKS / PAGE_SIZE);
    pagination.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "← Prev";
    prev.disabled = currentPage === 1;
    prev.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prev);

    const label = document.createElement("span");
    label.textContent = `Page ${currentPage} / ${totalPages}`;
    pagination.appendChild(label);

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

  // Render blocks
  function renderPage(pageNum) {
    grid.innerHTML = "";

    const start = (pageNum - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

    for (let i = start; i <= end; i++) {
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

    renderPagination();
  }

  // Search
  function searchBlock() {
    const target = Number(searchInput.value);
    if (!target || target < 1 || target > TOTAL_BLOCKS) return;

    const page = Math.ceil(target / PAGE_SIZE);

    if (page !== currentPage) {
      currentPage = page;
      renderPage(page);
      setTimeout(() => highlight(target), 50);
    } else {
      highlight(target);
    }
  }

  function highlight(num) {
    const blocks = document.querySelectorAll(".block");
    const block = Array.from(blocks).find(b => Number(b.textContent) === num);
    if (!block) return;

    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.classList.add("search-highlight");
    setTimeout(() => block.classList.remove("search-highlight"), 2000);
  }

  searchBtn.addEventListener("click", searchBlock);
  searchInput.addEventListener("change", searchBlock);

  // Modal close
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // Validation
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  // Save button
  saveBtn.addEventListener("click", async () => {
    if (!valid()) {
      alert("Fill in all fields + upload image");
      return;
    }

    const pending = {
      blockNumber: selected,
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value
    };

    await saveBlock(pending);

    if (!claimed.includes(selected)) {
      claimed.push(selected);
      localStorage.setItem("claimed", JSON.stringify(claimed));
    }

    readyMsg.classList.remove("hidden");
    paypalWrapper.classList.remove("hidden");

    renderPage(currentPage);
  });
});

// Loader fade-out
function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  setTimeout(() => {
    loader.style.opacity = 0;
    loader.style.pointerEvents = "none";

    setTimeout(() => loader.remove(), 400);
    main.classList.add("vault-main-visible");

  }, 1200);
                            }
