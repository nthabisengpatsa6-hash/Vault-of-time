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

// === CONFIG ====================================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
let currentPage = 1;
let claimed = [];

// === LOAD CLAIMED BLOCKS ========================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs.map((d) => Number(d.id));
    localStorage.setItem("claimed", JSON.stringify(claimed));
  } catch (err) {
    console.error("Error loading claimed blocks:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}

// === FETCH BLOCK ================================
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

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

// === MAIN ========================================
document.addEventListener("DOMContentLoaded", async () => {
  // SIDE MENU
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");

  function openMenu() {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  }

  function closeMenuFn() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  }

  if (menuToggle) menuToggle.addEventListener("click", openMenu);
  if (closeMenu) closeMenu.addEventListener("click", closeMenuFn);
  if (overlay) overlay.addEventListener("click", closeMenuFn);

  try {
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

    const banner = document.getElementById("rules-banner");
    const ackBtn = document.getElementById("acknowledgeBtn");

    const searchInput = document.getElementById("blockSearch");
    const searchBtn = document.getElementById("searchBtn");

    const saveBtn = document.getElementById("uploadBtn");
    const hiddenBlockNumber = document.getElementById("blockNumber");

    let selected = null;

    // === MESSAGE CHARACTER LIMIT (NEW FEATURE) =====================
    const MESSAGE_MAX = 300;

    messageInput.addEventListener("input", () => {
      if (messageInput.value.length > MESSAGE_MAX) {
        messageInput.value = messageInput.value.slice(0, MESSAGE_MAX);
      }

      let counter = document.getElementById("messageCounter");
      if (counter) counter.textContent = `${messageInput.value.length} / ${MESSAGE_MAX}`;
    });
    // ===============================================================

    // === PAGINATION ===
    const renderPagination = () => {
      const totalPages = Math.ceil(TOTAL_BLOCKS / PAGE_SIZE);

      pagination.innerHTML = "";

      const prev = document.createElement("button");
      prev.textContent = "← Prev";
      prev.disabled = currentPage === 1;
      prev.onclick = () => changePage(currentPage - 1);

      const info = document.createElement("span");
      info.textContent = `Page ${currentPage} / ${totalPages}`;

      const next = document.createElement("button");
      next.textContent = "Next →";
      next.disabled = currentPage === totalPages;
      next.onclick = () => changePage(currentPage + 1);

      pagination.appendChild(prev);
      pagination.appendChild(info);
      pagination.appendChild(next);
    };

    const changePage = (page) => {
      currentPage = page;
      renderPage(page);
    };

    // === RENDER PAGE ===
    const renderPage = (pageNum) => {
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
            document.getElementById("viewBlockMedia").innerHTML =
              data?.imageUrl ? `<img src="${data.imageUrl}" style="max-width:100%;border-radius:8px;">` : "";

            viewModal.classList.remove("hidden");
            return;
          }

          document.querySelectorAll(".block").forEach((b) =>
            b.classList.remove("selected")
          );

          div.classList.add("selected");
          selected = i;
          hiddenBlockNumber.value = i;

          document.getElementById("selected-block-text").textContent = `Selected Block: #${i}`;
          modal.classList.remove("hidden");
        };

        grid.appendChild(div);
      }

      renderPagination();
    };

    // === SEARCH ===
    const highlightBlock = (num) => {
      const blocks = document.querySelectorAll(".block");
      const block = Array.from(blocks).find((b) => Number(b.textContent) === num);
      if (!block) return;

      block.scrollIntoView({ behavior: "smooth", block: "center" });
      block.classList.add("search-highlight");
      setTimeout(() => block.classList.remove("search-highlight"), 2000);
    };

    const searchBlock = () => {
      const target = Number(searchInput.value);
      if (!target || target < 1 || target > TOTAL_BLOCKS) return;

      const page = Math.ceil(target / PAGE_SIZE);

      if (page !== currentPage) {
        currentPage = page;
        renderPage(page);
        setTimeout(() => highlightBlock(target), 80);
      } else {
        highlightBlock(target);
      }
    };

    // === VALIDATION ===
    const valid = () => {
      if (messageInput.value.length > MESSAGE_MAX) return false;
      return (
        hiddenBlockNumber.value &&
        nameInput.value.trim() &&
        emailInput.value.trim() &&
        fileInput.files.length > 0
      );
    };

    // === SAVE BLOCK ===
    const handleSave = async () => {
      const blockId = hiddenBlockNumber.value;
      if (!valid()) {
        alert("Please fill all fields. Message max = 300 characters.");
        return;
      }

      try {
        const file = fileInput.files[0];
        const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
        await uploadBytes(fileRef, file);

        const imageUrl = await getDownloadURL(fileRef);

        await setDoc(doc(blocksCollection, blockId), {
          blockNumber: Number(blockId),
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          imageUrl,
          purchasedAt: serverTimestamp()
        });

        if (!claimed.includes(Number(blockId))) {
          claimed.push(Number(blockId));
          localStorage.setItem("claimed", JSON.stringify(claimed));
        }

        readyMsg.classList.remove("hidden");
        paypalWrapper.classList.remove("hidden");

        renderPage(currentPage);
      } catch (err) {
        alert("Upload failed: " + err.message);
      }
    };

    // === INIT ===
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
    await loadClaimedBlocks();
    renderPage(currentPage);
    hideLoader();

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

    // Accordion
    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const open = header.classList.contains("active");

        document.querySelectorAll(".accordion-header").forEach((h) =>
          h.classList.remove("active")
        );
        document.querySelectorAll(".accordion-content").forEach((c) =>
          c.classList.remove("show")
        );

        if (!open) {
          header.classList.add("active");
          content.classList.add("show");
        }
      });
    });

    searchBtn.addEventListener("click", searchBlock);
    searchInput.addEventListener("change", searchBlock);

    closeBtn.onclick = () => modal.classList.add("hidden");
    viewClose.onclick = () => viewModal.classList.add("hidden");

    saveBtn.addEventListener("click", handleSave);
  } catch (err) {
    console.error("Fatal Vault error:", err);
    alert("Vault error: " + err.message);
  }
});
