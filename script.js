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

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

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
const storage = getStorage(app);
const blocksCollection = collection(db, "blocks");

let claimed = [];

// === CONFIG ====================================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
let currentPage = 1;

// === LOAD CLAIMED BLOCKS ========================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch (err) {
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// === FETCH BLOCK ================================
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

// === MAIN ========================================
document.addEventListener("DOMContentLoaded", async () => {

  // DOM references
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

  const banner = document.getElementById("rules-banner");
  const ackBtn = document.getElementById("acknowledgeBtn");

  const searchInput = document.getElementById("blockSearch");
  const searchBtn = document.getElementById("searchBtn");

  const saveBtn = document.getElementById("uploadBtn");

  let selected = null;

  // Load data
  claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  await loadClaimedBlocks();
  renderPage(currentPage);

  hideLoader();

  // RULES BANNER CONTROL
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

  // ACCORDION FIX
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

  // === PAGINATION UI ================================
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

  // === RENDER PAGE ================================
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
          document.getElementById("viewBlockMedia").innerHTML = data?.imageUrl
            ? `<img src="${data.imageUrl}" style="max-width:100%;border-radius:8px;">`
            : "";
          viewModal.classList.remove("hidden");
          return;
        }

        document.querySelectorAll(".block").forEach(b =>
          b.classList.remove("selected")
        );

        div.classList.add("selected");
        selected = i;
        document.getElementById("blockNumber").value = i;
        document.getElementById("selected-block-text").textContent =
          `Selected Block: #${i}`;
        modal.classList.remove("hidden");
      };

      grid.appendChild(div);
    }

    renderPagination();
  }

  // === SEARCH ============================
  function searchBlock() {
    const target = Number(searchInput.value);
    if (!target || target < 1 || target > TOTAL_BLOCKS) return;

    const page = Math.ceil(target / PAGE_SIZE);

    if (page !== currentPage) {
      currentPage = page;
      renderPage(page);
      setTimeout(() => highlightBlock(target), 50);
    } else {
      highlightBlock(target);
    }
  }

  function highlightBlock(num) {
    const blocks = document.querySelectorAll(".block");
    const block = Array.from(blocks).find(b => Number(b.textContent) === num);

    if (!block) return;

    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.classList.add("search-highlight");
    setTimeout(() => {
      block.classList.remove("search-highlight");
    }, 2000);
  }

  searchBtn.addEventListener("click", searchBlock);
  searchInput.addEventListener("change", searchBlock);

  // CLOSE MODALS
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === VALIDATION CHECK =================
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  // === SAVE BLOCK + UPLOAD IMAGE =================
  async function handleSave() {
    if (!valid()) {
      alert("Please fill all fields + upload an image");
      return;
    }

    const file = fileInput.files[0];
    const blockId = String(selected);

    // Upload file to storage
    const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
    await uploadBytes(fileRef, file);

    // Get public URL
    const imageUrl = await getDownloadURL(fileRef);

    // Save Firestore entry
    await setDoc(doc(blocksCollection, blockId), {
      blockNumber: selected,
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value,
      imageUrl,
      purchasedAt: serverTimestamp()
    });

    if (!claimed.includes(selected)) {
      claimed.push(selected);
      localStorage.setItem("claimed", JSON.stringify(claimed));
    }

    readyMsg.classList.remove("hidden");
    paypalWrapper.classList.remove("hidden");

    renderPage(currentPage);
  }

  saveBtn.addEventListener("click", handleSave);
});

// === LOADER ========================
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
