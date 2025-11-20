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
const MAX_MESSAGE_LENGTH = 300;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

let currentPage = 1;
let claimed = [];

// === LOAD CLAIMED BLOCKS ========================
// Only treat docs with status === "paid" as sealed blocks
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimed = snap.docs
      .map((d) => ({ id: Number(d.id), data: d.data() }))
      .filter((b) => b.data && b.data.status === "paid")
      .map((b) => b.id);

    localStorage.setItem("claimed", JSON.stringify(claimed));
    console.log("Loaded claimed PAID blocks:", claimed.length);
  } catch (err) {
    console.error("Error loading claimed blocks, using local cache:", err);
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
  console.log("🔥 DOM fully loaded — JS starting");

  // === SIDE MENU TOGGLE ===
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
    const hiddenBlockNumber = document.getElementById("blockNumber");

    if (!grid) {
      alert("Vault error: grid container missing.");
      return;
    }

    console.log("✔ saveBtn FOUND:", !!saveBtn);

    let selected = null; // UI helper only – source of truth is hiddenBlockNumber.value

    // === PAGINATION ===
    const renderPagination = () => {
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

        if (claimed.includes(i)) div.classList.add("claimed");

        div.onclick = async () => {
          console.log("Clicked block:", i);

          // VIEW BLOCK (paid / sealed)
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);
            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");

            if (titleEl) titleEl.textContent = `Block #${i}`;
            if (msgEl) msgEl.textContent = data?.message || "";
            if (mediaEl) {
              mediaEl.innerHTML = data?.imageUrl
                ? `<img src="${data.imageUrl}" style="max-width:100%;border-radius:8px;">`
                : "";
            }

            if (viewModal) viewModal.classList.remove("hidden");
            return;
          }

          // SELECT BLOCK TO BUY
          document.querySelectorAll(".block").forEach((b) =>
            b.classList.remove("selected")
          );
          div.classList.add("selected");

          selected = i;
          if (hiddenBlockNumber) {
            hiddenBlockNumber.value = i;
            console.log("Selected block stored in hidden input:", hiddenBlockNumber.value);
          }

          const selectedText = document.getElementById("selected-block-text");
          if (selectedText) {
            selectedText.textContent = `Selected Block: #${i}`;
          }

          if (modal) modal.classList.remove("hidden");
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
        setTimeout(() => highlightBlock(target), 100);
      } else {
        highlightBlock(target);
      }
    };

    // === VALIDATION ===
    const valid = () => {
      if (!hiddenBlockNumber || !hiddenBlockNumber.value) return false;
      if (!nameInput.value.trim()) return false;
      if (!emailInput.value.trim()) return false;
      if (!fileInput.files || fileInput.files.length === 0) return false;

      // Enforce 300-char limit in JS as well
      if (messageInput && messageInput.value.length > MAX_MESSAGE_LENGTH) {
        alert(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
        return false;
      }

      // Enforce 2MB file limit
      const file = fileInput.files[0];
      if (file && file.size > MAX_FILE_SIZE_BYTES) {
        alert("Image is too large. Maximum size is 2MB.");
        return false;
      }

      return true;
    };

    // === PAYPAL RETURN HANDLER ===
    const handlePaypalReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const paid = params.get("paid");

      if (paid !== "true") return;

      const pendingBlockId = localStorage.getItem("pendingBlockId");
      if (!pendingBlockId) return;

      try {
        console.log("Finalising PayPal payment for block:", pendingBlockId);

        // Mark block as paid in Firestore
        await setDoc(
          doc(blocksCollection, pendingBlockId),
          {
            status: "paid",
            purchasedAt: serverTimestamp()
          },
          { merge: true }
        );

        const numId = Number(pendingBlockId);
        if (!claimed.includes(numId)) {
          claimed.push(numId);
          localStorage.setItem("claimed", JSON.stringify(claimed));
        }

        localStorage.removeItem("pendingBlockId");

        alert("Payment received!🎉 Your block is now sealed in the Vault.");
      } catch (err) {
        console.error("Error finalising PayPal payment:", err);
        alert("We received your return from PayPal but could not seal the block automatically. Please contact support.");
      }
    };

    // === SAVE BLOCK (DETAILS + PENDING STATE) ===
    const handleSave = async () => {
      console.log("👉 Save button clicked");

      if (!valid()) {
        // valid() already shows relevant alerts
        return;
      }

      const blockId = hiddenBlockNumber.value;
      console.log("Block ID from hidden field:", blockId);

      try {
        const file = fileInput.files[0];

        // Upload file to storage
        const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
        await uploadBytes(fileRef, file);

        // Get public URL
        const imageUrl = await getDownloadURL(fileRef);

        // Save Firestore entry as PENDING
        await setDoc(doc(blocksCollection, blockId), {
          blockNumber: Number(blockId),
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          imageUrl,
          status: "pending",
          purchasedAt: null
        });

        // Store pending block in localStorage so we know what to seal after PayPal
        localStorage.setItem("pendingBlockId", blockId);

        if (readyMsg) readyMsg.classList.remove("hidden");
        if (paypalWrapper) paypalWrapper.classList.remove("hidden");

        console.log("Details saved, block pending payment:", blockId);
      } catch (err) {
        console.error("Error saving block:", err);
        alert("Upload failed: " + (err.message || err));
      }
    };

    // === INIT FLOW ===
    // 1) Load existing paid blocks
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
    await loadClaimedBlocks();

    // 2) Handle PayPal return (?paid=true)
    await handlePaypalReturn();

    // 3) Render grid + loader
    renderPage(currentPage);
    hideLoader();

    // 4) Rules banner
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

    // === ACCORDION (UNCHANGED) ===
    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const open = header.classList.contains("active");

        document
          .querySelectorAll(".accordion-header")
          .forEach((h) => h.classList.remove("active"));
        document
          .querySelectorAll(".accordion-content")
          .forEach((c) => c.classList.remove("show"));

        if (!open) {
          header.classList.add("active");
          content.classList.add("show");
        }
      });
    });

    // === EVENTS ===
    if (searchBtn) searchBtn.addEventListener("click", searchBlock);
    if (searchInput) searchInput.addEventListener("change", searchBlock);

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add("hidden");
    }
    if (viewClose && viewModal) {
      viewClose.onclick = () => viewModal.classList.add("hidden");
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", handleSave);
    }

    console.log("🔥 Vault initialisation complete");
  } catch (err) {
    console.error("Vault fatal error:", err);
    alert("Vault error: " + (err.message || err));
  }
});
