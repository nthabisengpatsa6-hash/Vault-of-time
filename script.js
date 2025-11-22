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

      if (messageInput.value.length > MAX_MESSAGE_LENGTH) {
        alert(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
        return false;
      }

      const file = fileInput.files[0];
      const fileType = file.type || "";

      const isImage = fileType.startsWith("image/");
      const isAudio = fileType.startsWith("audio/");
      if (!isImage && !isAudio) {
        alert("Please upload either an image or an audio file.");
        return false;
      }

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

        const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
        await uploadBytes(fileRef, file);

        const mediaUrl = await getDownloadURL(fileRef);

        await setDoc(doc(blocksCollection, blockId), {
          blockNumber: Number(blockId),
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          mediaUrl,
          mediaType: isAudio ? "audio" : "image",
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

          if (mediaUrl && mediaType === "image") {
            div.classList.add("claimed-has-image");
            div.style.backgroundImage = `url(${mediaUrl})`;
            div.style.backgroundSize = "cover";
            div.style.backgroundPosition = "center";
            div.style.backgroundRepeat = "no-repeat";
            div.style.color = "transparent";
          }

          if (mediaUrl && mediaType === "audio") {
            div.classList.add("claimed-has-audio");
          }
        }

        div.onclick = async () => {
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);
            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");
            const badgeBox = document.getElementById("viewBlockBadge"); // ⭐ badge container

            if (titleEl) titleEl.textContent = `Block #${i}`;

            // ----------------------------
            // ⭐ BADGE LOGIC WILL BE INSERTED HERE IN PART 4
            // ----------------------------

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
            if (msgEl) msgEl.textContent = data?.message || "";

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
    // -----------------------------------------------------
            // ⭐ BADGE SYSTEM — VAULT KEEPERS (CHAPTER 1)
            // -----------------------------------------------------

            if (badgeBox) {
              let badgeSvg = "";

              // Badge 1: Blocks 1–25 000
              const badge1 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="50" stroke="#D4AF37" stroke-width="3"/>
  <circle cx="60" cy="60" r="38" stroke="#00D4FF" stroke-width="1" stroke-dasharray="4 6"/>
  <path d="M60 30 L60 65" stroke="#D4AF37" stroke-width="4" stroke-linecap="round"/>
  <circle cx="60" cy="25" r="7" stroke="#D4AF37" stroke-width="3"/>
  <rect x="57" y="65" width="6" height="8" fill="#D4AF37"/>
  <rect x="57" y="74" width="6" height="4" fill="#D4AF37"/>
  <line x1="42" y1="85" x2="78" y2="85" stroke="#00D4FF" stroke-width="2" stroke-linecap="round"/>
  <line x1="50" y1="92" x2="70" y2="92" stroke="#00D4FF" stroke-width="2" stroke-linecap="round"/>
</svg>`;

              // Badge 2: Blocks 25 001–50 000
              const badge2 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="50" stroke="#D4AF37" stroke-width="3"/>
  <circle cx="60" cy="60" r="40" stroke="#00D4FF" stroke-width="1.5" stroke-dasharray="6 8"/>
  <circle cx="60" cy="20" r="5" fill="#D4AF37"/>
  <circle cx="100" cy="60" r="5" fill="#D4AF37"/>
  <circle cx="60" cy="100" r="5" fill="#D4AF37"/>
  <circle cx="20" cy="60" r="5" fill="#D4AF37"/>
  <rect x="52" y="35" width="16" height="50" rx="3" fill="#D4AF37"/>
  <line x1="60" y1="38" x2="60" y2="80" stroke="#1A1A1A" stroke-width="3" opacity="0.3"/>
</svg>`;

              // Badge 3: Blocks 50 001–75 000
              const badge3 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="50" stroke="#D4AF37" stroke-width="3"/>
  <rect x="38" y="30" width="8" height="60" fill="#D4AF37" opacity="0.3"/>
  <rect x="74" y="30" width="8" height="60" fill="#D4AF37" opacity="0.3"/>
  <path d="M60 35 L85 55 L75 90 L45 90 L35 55 Z" fill="#D4AF37"/>
  <path d="M60 45 L70 60 L60 75 L50 60 Z" fill="#1A1A1A" opacity="0.3"/>
  <path d="M60 50 C65 55 62 65 60 68 C58 65 55 55 60 50Z" fill="#00D4FF"/>
</svg>`;

              // Badge 4: Blocks 75 001–100 000
              const badge4 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,15 100,60 60,105 20,60" stroke="#D4AF37" stroke-width="3" fill="none"/>
  <path d="M45 70 Q60 85 75 70" stroke="#D4AF37" stroke-width="3" fill="none"/>
  <path d="M60 55 C70 65 62 80 60 83 C58 80 50 65 60 55Z" fill="#D4AF37"/>
  <path d="M60 58 C66 64 63 73 60 75 C57 73 54 64 60 58Z" fill="#00D4FF"/>
  <circle cx="60" cy="40" r="4" fill="#D4AF37"/>
</svg>`;

              // Determine badge
              if (i >= 1 && i <= 25000) badgeSvg = badge1;
              else if (i <= 50000) badgeSvg = badge2;
              else if (i <= 75000) badgeSvg = badge3;
              else if (i <= 100000) badgeSvg = badge4;

              badgeBox.innerHTML = badgeSvg;
            }
    // END OF VIEW MODAL LOGIC
          }; // end of div.onclick

        grid.appendChild(div);
      }

      renderPagination();
    }; // END renderPage()


    // === CLOSE VIEW MODAL ===
    if (viewClose) {
      viewClose.onclick = () => {
        if (viewModal) viewModal.classList.add("hidden");
      };
    }

    // === CLOSE UPLOAD MODAL ===
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (modal) modal.classList.add("hidden");
      };
    }

    // === RULES BANNER ACKNOWLEDGE ===
    if (ackBtn && banner) {
      ackBtn.addEventListener("click", () => {
        banner.classList.add("hidden");
        document.body.classList.remove("no-scroll");
      });
    }

    // === SEARCH BUTTON ===
    if (searchBtn) {
      searchBtn.onclick = searchBlock;
    }

    // === SAVE BUTTON ===
    if (saveBtn) {
      saveBtn.onclick = handleSave;
    }

    // === PAYPAL BUTTON ===
    const payBtn = document.getElementById("paypalBtn");
    if (payBtn) {
      payBtn.onclick = () => {
        const blockId = hiddenBlockNumber.value;
        if (!blockId) {
          alert("No block selected.");
          return;
        }

        // Set pending
        localStorage.setItem("pendingBlockId", blockId);

        // Redirect to PayPal
        window.location.href =
          `https://vaultoftime.com/paypal/pay.php?block=${blockId}`;
      };
    }

    // === EXECUTE PAYPAL RETURN HANDLER ===
    await handlePaypalReturn();

    // === INITIAL LOAD ===
    await loadClaimedBlocks();
    renderPage(currentPage);

  } catch (err) {
    console.error("FATAL error during Vault initialisation:", err);
    alert("An error occurred setting up The Vault. Please refresh.");
  }

  hideLoader();

}); // END DOMContentLoaded
/* ============================
   ACCORDION INTERACTION
============================ */

document.querySelectorAll(".accordion-header").forEach((header) => {
  header.addEventListener("click", () => {
    const content = header.nextElementSibling;
    const alreadyOpen = header.classList.contains("active");

    document.querySelectorAll(".accordion-header")
      .forEach((h) => h.classList.remove("active"));
    document.querySelectorAll(".accordion-content")
      .forEach((c) => c.classList.remove("show"));

    if (!alreadyOpen) {
      header.classList.add("active");
      content.classList.add("show");
    }
  });
});
