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
let blockCache = {}; // id -> Firestore data for PAID blocks


// === LOAD CLAIMED BLOCKS (ONLY PAID ONES) ===============
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);

    claimed = [];
    blockCache = {};

    snap.docs.forEach((d) => {
      const idNum = Number(d.id);
      const data = d.data();
      if (!data) return;

      if (data.status === "paid") {
        claimed.push(idNum);
        blockCache[idNum] = data;
      }
    });

    localStorage.setItem("claimed", JSON.stringify(claimed));
    console.log("Loaded claimed PAID blocks:", claimed.length);
  } catch (err) {
    console.error("Error loading claimed blocks, using local cache:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
  }
}


// === FETCH BLOCK (fallback / always-fresh for view modal) ===
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
    const messageCounter = document.getElementById("messageCounter");
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

    // === LIVE MESSAGE COUNTER ===
    if (messageInput && messageCounter) {
      messageInput.addEventListener("input", () => {
        const length = messageInput.value.length;
        messageCounter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
      });
    }

    // === SEARCH HIGHLIGHT ===
    const highlightBlock = (num) => {
      const blocks = [...document.querySelectorAll(".block")];
      const block = blocks.find((b) => Number(b.textContent) === num);
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
        setTimeout(() => highlightBlock(target), 120);
      } else {
        highlightBlock(target);
      }
    };

    // === VALIDATION ===
    const valid = () => {
      if (!hiddenBlockNumber.value) return false;
      if (!nameInput.value.trim()) return false;
      if (!emailInput.value.trim()) return false;
      if (!fileInput.files.length) return false;

      // message length
      if (messageInput.value.length > MAX_MESSAGE_LENGTH) {
        alert(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
        return false;
      }

      const file = fileInput.files[0];
      const fileType = file.type || "";

      // Only allow image OR audio
      const isImage = fileType.startsWith("image/");
      const isAudio = fileType.startsWith("audio/");
      if (!isImage && !isAudio) {
        alert("Please upload either an image or an audio file.");
        return false;
      }

      // FILE SIZE
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert("File too large. Max 2MB.");
        return false;
      }

      return true;
    };


    // === PAYPAL RETURN HANDLER ==========================
    const handlePaypalReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("paid") !== "true") return;

      const pendingBlockId = localStorage.getItem("pendingBlockId");
      if (!pendingBlockId) return;

      try {
        // Mark as paid
        await setDoc(
          doc(blocksCollection, pendingBlockId),
          {
            status: "paid",
            purchasedAt: serverTimestamp()
          },
          { merge: true }
        );

        const numId = Number(pendingBlockId);

        // update local claimed (just in case)
        if (!claimed.includes(numId)) {
          claimed.push(numId);
          localStorage.setItem("claimed", JSON.stringify(claimed));
        }

        // Fetch fresh doc so blockCache can be correct if we want to use it immediately
        const snap = await getDoc(doc(blocksCollection, pendingBlockId));
        if (snap.exists()) {
          blockCache[numId] = snap.data();
        }

        localStorage.removeItem("pendingBlockId");

        alert("Payment received!🎉 Your block is now sealed in the Vault.");
      } catch (err) {
        console.error("Error finalising PayPal payment:", err);
        alert("We received your return from PayPal, but something went wrong. Please contact support.");
      }
    };

    // === SAVE (PENDING) ============================
    const handleSave = async () => {
      if (!valid()) return;

      const blockId = hiddenBlockNumber.value;

      try {
        const file = fileInput.files[0];
        const fileType = file.type || "";

        const isImage = fileType.startsWith("image/");
        const isAudio = fileType.startsWith("audio/");

        if (!isImage && !isAudio) {
          alert("Please upload either an image or an audio file.");
          return;
        }

        // Upload to storage
        const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
        await uploadBytes(fileRef, file);

        const mediaUrl = await getDownloadURL(fileRef);

        // write pending doc
        await setDoc(doc(blocksCollection, blockId), {
          blockNumber: Number(blockId),
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          mediaUrl,
          mediaType: isAudio ? "audio" : "image",
          // keep old fields for backwards compatibility / future use
          imageUrl: isImage ? mediaUrl : null,
          audioUrl: isAudio ? mediaUrl : null,
          status: "pending",
          purchasedAt: null
        });

        localStorage.setItem("pendingBlockId", blockId);

        if (readyMsg) readyMsg.classList.remove("hidden");
        if (paypalWrapper) paypalWrapper.classList.remove("hidden");
      } catch (err) {
        console.error("Error saving block:", err);
        alert("Upload failed: " + err.message);
      }
    };


    // PAGE + PAGINATION ======================
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


    // === RENDER PAGE (GRID) ===
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

          const data = blockCache[i];
          const mediaUrl = data?.mediaUrl || data?.imageUrl || null;
          const mediaType = data?.mediaType || (data?.imageUrl ? "image" : null);

          // Mosaic preview for images
          if (mediaUrl && mediaType === "image") {
            div.classList.add("claimed-has-image");
            div.style.backgroundImage = `url(${mediaUrl})`;
            div.style.backgroundSize = "cover";
            div.style.backgroundPosition = "center";
            div.style.backgroundRepeat = "no-repeat";
            // number becomes subtle / hidden so the image is the focus
            div.style.color = "transparent";
          }

          // Audio marker – CSS will show an icon
          if (mediaUrl && mediaType === "audio") {
            div.classList.add("claimed-has-audio");
          }
        }

        div.onclick = async () => {
          // VIEW BLOCK (SEALED)
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);
            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");

            if (titleEl) titleEl.textContent = `Block #${i}`;
            if (msgEl) msgEl.textContent = data?.message || "";

            const mediaUrl = data?.mediaUrl || data?.imageUrl || null;
            const mediaType = data?.mediaType || (data?.imageUrl ? "image" : null);

            let mediaHtml = "";
            if (mediaUrl) {
              if (mediaType === "audio") {
                mediaHtml = `
                  <audio controls style="width:100%;margin:10px 0 5px;">
                    <source src="${mediaUrl}" type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                `;
              } else {
                mediaHtml = `<img src="${mediaUrl}" style="max-width:100%;border-radius:8px;" />`;
              }
            }

            if (mediaEl) mediaEl.innerHTML = mediaHtml;

            if (viewModal) viewModal.classList.remove("hidden");
            return;
          }

          // SELECT NEW BLOCK
          document.querySelectorAll(".block").forEach((b) =>
            b.classList.remove("selected")
          );
          div.classList.add("selected");

          hiddenBlockNumber.value = i;

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


    // === INIT FLOW ================================
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");

    // 1) Handle PayPal return FIRST so the Firestore doc is marked paid
    await handlePaypalReturn();

    // 2) Load claimed blocks from Firestore (including new paid ones)
    await loadClaimedBlocks();

    // 3) Render grid + loader
    renderPage(currentPage);
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

    // ACCORDION (unchanged)
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

    // EVENTS
    if (searchBtn) searchBtn.addEventListener("click", searchBlock);
    if (searchInput) searchInput.addEventListener("change", searchBlock);

    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    if (viewClose) viewClose.addEventListener("click", () => viewModal.classList.add("hidden"));

    if (saveBtn) saveBtn.addEventListener("click", handleSave);
  } catch (err) {
    console.error("Vault fatal error:", err);
    alert("Vault error: " + err.message);
  }
});
