// ================= FIREBASE IMPORTS =================
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


// ================= FIREBASE CONFIG ==================
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


// ================= GLOBAL CONFIG ====================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
const MAX_MESSAGE_LENGTH = 300;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

let currentPage = 1;
let claimed = [];          // paid blocks
let reservedBlocks = [];   // reserved but not paid
let blockCache = {};       // id → firestore data


// =========== LOAD CLAIMED + RESERVED BLOCKS =========
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);

    claimed = [];
    reservedBlocks = [];
    blockCache = {};

    const docs = snap.docs;

    for (const d of docs) {
      const idNum = Number(d.id);
      const data = d.data();
      if (!data) continue;

      blockCache[idNum] = data;

      // Auto-release expired reservations (30 minutes)
      if (data.reserved === true && data.reservedAt) {
        const now = Date.now();
        const reservedTime = data.reservedAt.toMillis();
        const thirtyMinutes = 30 * 60 * 1000;

        if (now - reservedTime > thirtyMinutes) {
          console.log("Auto-releasing expired reservation:", idNum);

          await setDoc(
            doc(blocksCollection, String(idNum)),
            {
              reserved: false,
              reservedBy: null,
              reservedAt: null
            },
            { merge: true }
          );

          data.reserved = false;
          data.reservedBy = null;
          data.reservedAt = null;
        }
      }

      if (data.status === "paid") {
        claimed.push(idNum);
      } else if (data.reserved === true) {
        reservedBlocks.push(idNum);
      }

      blockCache[idNum] = data;
    }

    // Cache in localStorage as fallback
    localStorage.setItem("claimed", JSON.stringify(claimed));
    localStorage.setItem("reservedBlocks", JSON.stringify(reservedBlocks));

    console.log(
      "Loaded → Claimed:",
      claimed.length,
      "Reserved:",
      reservedBlocks.length
    );

  } catch (err) {
    console.error("Error loading block states:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
    reservedBlocks = JSON.parse(localStorage.getItem("reservedBlocks") || "[]");
  }
}


// ================= FETCH SINGLE BLOCK ===============
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}


// ================= HIDE LOADER ======================
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
  }, 1600);
}


// ================= MAIN LOGIC =======================
document.addEventListener("DOMContentLoaded", async () => {

  // --------- MENU TOGGLE ----------
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");

  function openMenu() {
    if (sideMenu) sideMenu.classList.add("open");
    if (overlay) overlay.classList.add("show");
  }

  function closeMenuFn() {
    if (sideMenu) sideMenu.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
  }

  if (menuToggle) menuToggle.addEventListener("click", openMenu);
  if (closeMenu) closeMenu.addEventListener("click", closeMenuFn);
  if (overlay) overlay.addEventListener("click", closeMenuFn);

  // Header → home
  const headerTitle = document.querySelector(".vault-title");
  if (headerTitle) {
    headerTitle.style.cursor = "pointer";
    headerTitle.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  try {
    // --------- DOM REFERENCES ----------
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
    const paymentButtons = document.getElementById("paymentButtons");

    const banner = document.getElementById("rules-banner");
    const ackBtn = document.getElementById("acknowledgeBtn");

    const searchInput = document.getElementById("blockSearch");
    const searchBtn = document.getElementById("searchBtn");
    const saveBtn = document.getElementById("uploadBtn");
    const hiddenBlockNumber = document.getElementById("blockNumber");

    if (!grid || !pagination || !modal || !viewModal) {
      alert("Vault error: required DOM elements missing.");
      hideLoader();
      return;
    }

    // --------- LIVE MESSAGE COUNTER ----------
    if (messageInput && messageCounter) {
      messageInput.addEventListener("input", () => {
        messageCounter.textContent =
          `${messageInput.value.length}/${MAX_MESSAGE_LENGTH}`;
      });
    }

    // --------- SEARCH ----------
    const highlightBlock = (num) => {
      const blocks = [...document.querySelectorAll(".block")];
      const target = blocks.find((b) => Number(b.dataset.blockId) === num);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("search-highlight");
      setTimeout(() => target.classList.remove("search-highlight"), 2000);
    };

    const searchBlock = () => {
      if (!searchInput) return;
      const target = Number(searchInput.value);
      if (!target || target < 1 || target > TOTAL_BLOCKS) return;

      const page = Math.ceil(target / PAGE_SIZE);
      if (page !== currentPage) {
        currentPage = page;
        renderPage(page);
        setTimeout(() => highlightBlock(target), 150);
      } else {
        highlightBlock(target);
      }
    };

    // --------- VALIDATION ----------
    const valid = () => {
      if (!hiddenBlockNumber.value) return false;
      if (!nameInput.value.trim()) return false;
      if (!emailInput.value.trim()) return false;
      if (!fileInput.files.length) return false;

      if (messageInput.value.length > MAX_MESSAGE_LENGTH) {
        alert("Message too long.");
        return false;
      }

      const file = fileInput.files[0];
      const type = file.type || "";
      const isImg = type.startsWith("image/");
      const isAud = type.startsWith("audio/");

      if (!isImg && !isAud) {
        alert("Upload an image or audio file.");
        return false;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert("File too large (max 2MB).");
        return false;
      }

      return true;
    };

    // --------- PAYPAL RETURN HANDLER ----------
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
        if (snap.exists()) blockCache[numId] = snap.data();

        localStorage.removeItem("pendingBlockId");

        alert("Payment received! 🎉 Your block is sealed.");
      } catch (err) {
        console.error("Error finalising PayPal:", err);
        alert("Payment received but an error occurred.");
      }
    };

    // --------- SAVE (PENDING) ----------
    const handleSave = async () => {
      if (!valid()) return;

      const blockId = hiddenBlockNumber.value;

      try {
        const file = fileInput.files[0];
        const fileType = file.type || "";
        const isImg = fileType.startsWith("image/");
        const isAud = fileType.startsWith("audio/");

        const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
        await uploadBytes(fileRef, file);
        const mediaUrl = await getDownloadURL(fileRef);

        await setDoc(doc(blocksCollection, blockId), {
          blockNumber: Number(blockId),
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          mediaUrl,
          mediaType: isAud ? "audio" : "image",
          imageUrl: isImg ? mediaUrl : null,
          audioUrl: isAud ? mediaUrl : null,
          status: "pending",
          purchasedAt: null
        });

        localStorage.setItem("pendingBlockId", blockId);

        if (readyMsg) readyMsg.classList.remove("hidden");
        if (paymentButtons) paymentButtons.classList.remove("hidden");

        const payLink = document.getElementById("externalPayBtn");
        if (payLink) {
          payLink.href =
            `https://www.paypal.com/ncp/payment/MXNGF43VB6EYJ?block=${blockId}`;
        }

      } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed.");
      }
    };

    // --------- PAGINATION ----------
    const changePage = (page) => {
      currentPage = page;
      renderPage(page);
    };

    const renderPagination = () => {
      const totalPages = Math.ceil(TOTAL_BLOCKS / PAGE_SIZE);
      pagination.innerHTML = "";

      const prev = document.createElement("button");
      prev.textContent = "← Prev";
      prev.disabled = currentPage === 1;
      prev.onclick = () => changePage(currentPage - 1);
      pagination.appendChild(prev);

      const info = document.createElement("span");
      info.textContent = `Page ${currentPage} / ${totalPages}`;
      pagination.appendChild(info);

      const next = document.createElement("button");
      next.textContent = "Next →";
      next.disabled = currentPage === totalPages;
      next.onclick = () => changePage(currentPage + 1);
      pagination.appendChild(next);
    };

    // --------- RESERVE BLOCK ----------
    const reserveBlock = async (blockId, userEmail) => {
      try {
        const blockRef = doc(blocksCollection, String(blockId));
        const snap = await getDoc(blockRef);

        if (snap.exists() && snap.data().status === "paid") {
          alert("This block is already purchased.");
          return false;
        }

        if (snap.exists() && snap.data().reserved === true) {
          alert("Someone else has reserved this block. Try another.");
          return false;
        }

        await setDoc(
          blockRef,
          {
            reserved: true,
            reservedBy: userEmail,
            reservedAt: serverTimestamp()
          },
          { merge: true }
        );

        alert("Block reserved for 30 minutes! Complete your purchase.");
        return true;
      } catch (err) {
        console.error("Reservation error:", err);
        alert("Could not reserve block. Try again.");
        return false;
      }
    };

    // --------- RENDER PAGE ----------
    const renderPage = (pageNum) => {
      grid.innerHTML = "";

      const start = (pageNum - 1) * PAGE_SIZE + 1;
      const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

      for (let i = start; i <= end; i++) {
        const div = document.createElement("div");
        div.className = "block";
        div.textContent = i;
        div.dataset.blockId = i;

        // RESERVED appearance
        if (reservedBlocks.includes(i)) {
          const data = blockCache[i];
          const reservedBy = data?.reservedBy || null;

          const savedEmail = localStorage.getItem("userEmail");
          const userEmail =
            (emailInput?.value && emailInput.value.trim()) || savedEmail || null;

          if (userEmail && reservedBy === userEmail) {
            div.classList.add("reserved-owner");
            div.textContent = `${i} (Your Reserved Block)`;
          } else {
            div.classList.add("reserved");
            div.textContent = `${i} (R)`;
          }
        }

        // CLAIMED appearance
        if (claimed.includes(i)) {
          div.classList.add("claimed");

          const data = blockCache[i];
          const mediaUrl = data?.mediaUrl || data?.imageUrl;
          const mediaType =
            data?.mediaType ||
            (data?.imageUrl ? "image" : data?.audioUrl ? "audio" : null);

          if (mediaUrl && mediaType === "image") {
            div.classList.add("claimed-has-image");
            div.style.backgroundImage = `url(${mediaUrl})`;
            div.style.backgroundSize = "cover";
            div.style.backgroundPosition = "center";
            div.style.color = "transparent";
          }

          if (mediaUrl && mediaType === "audio") {
            div.classList.add("claimed-has-audio");
          }
        }

        // CLICK HANDLER
        div.onclick = async () => {
          const reservedWarning = document.getElementById("reservedWarning");
          const uploadBtn = document.getElementById("uploadBtn");

          // reset warning + upload btn
          if (reservedWarning) reservedWarning.classList.add("hidden");
          if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = "1";
          }

          // restore saved email if empty
          const storedEmail = localStorage.getItem("userEmail");
          if (storedEmail && emailInput && !emailInput.value.trim()) {
            emailInput.value = storedEmail;
          }

          // RESERVED BLOCK HANDLING — NEW LOCKED FORM VERSION
if (reservedBlocks.includes(i)) {
  const data = blockCache[i];
  const reservedBy = data?.reservedBy || null;

  const savedEmail = localStorage.getItem("userEmail");
  const typedEmail = emailInput?.value?.trim() || null;
  const userEmail = typedEmail || savedEmail;

  // If NOT the owner — lock the whole form UI
  if (!userEmail || reservedBy !== userEmail) {
    modal.classList.remove("hidden");

    // Show old warning message
    const warning = document.getElementById("reservedWarning");
    if (warning) warning.classList.remove("hidden");

    // Disable entire form visually + functionally
    const form = document.getElementById("blockForm");
    form.classList.add("locked-form");

    // Show locked note
    const lockedMsg = document.getElementById("lockedMsg");
    lockedMsg.classList.remove("hidden");

    // Set display text
    const selectedText = document.getElementById("selected-block-text");
    if (selectedText) {
      selectedText.textContent = `Block #${i} (Reserved by another user)`;
    }

    // Disable Upload button
    const uploadBtn = document.getElementById("uploadBtn");
    uploadBtn.disabled = true;
    uploadBtn.style.opacity = "0.3";

    return; // STOP — user cannot continue
  }

  // If the user IS the reserver → fully unlock the form
  document.getElementById("blockForm").classList.remove("locked-form");
  document.getElementById("lockedMsg").classList.add("hidden");
  document.getElementById("reservedWarning")?.classList.add("hidden");
}

          // VIEW CLAIMED BLOCK
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);

            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");

            if (titleEl) titleEl.textContent = `Block #${i}`;
            if (msgEl) msgEl.textContent = data?.message || "";

            if (mediaEl) {
              const mediaUrl = data?.mediaUrl || data?.imageUrl;
              const mediaType = data?.mediaType;

              if (mediaUrl && mediaType === "image") {
                mediaEl.innerHTML =
                  `<img src="${mediaUrl}" style="max-width:100%;border-radius:8px;" />`;
              } else if (mediaUrl && mediaType === "audio") {
                mediaEl.innerHTML = `
                  <audio controls style="width:100%;margin-top:10px;">
                    <source src="${mediaUrl}" />
                  </audio>
                `;
              } else {
                mediaEl.innerHTML = "";
              }
            }

            viewModal.classList.remove("hidden");
            return;
          }

          // UNCLAIMED / UNRESERVED or reserved-by-this-user → select for upload
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

    // --------- CLOSE MODALS ----------
    if (viewClose) {
      viewClose.onclick = () => viewModal.classList.add("hidden");
    }
    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.add("hidden");
    }

    // --------- RULES BANNER ----------
    if (ackBtn && banner) {
      ackBtn.addEventListener("click", () => {
        banner.classList.add("hidden");
        document.body.classList.remove("no-scroll");
      });
    }

    // --------- EVENTS ----------
    if (searchBtn) searchBtn.onclick = searchBlock;

    const reserveBtn = document.getElementById("reserveBtn");
    if (reserveBtn) {
      reserveBtn.onclick = async () => {
        const blockId = hiddenBlockNumber.value;
        const userEmail = emailInput.value.trim();

        if (!blockId) return alert("No block selected.");
        if (!userEmail) return alert("Enter your email before reserving.");

        const success = await reserveBlock(blockId, userEmail);
        if (success) {
          // remember email on this device
          localStorage.setItem("userEmail", userEmail);

          modal.classList.add("hidden");
          await loadClaimedBlocks();
          renderPage(currentPage);
        }
      };
    }

    // --------- TOOLTIP FOR RESERVE BUTTON ----------
    const infoIcon = document.querySelector(".reserve-info-icon");
    const tooltip = document.querySelector(".reserve-tooltip");

    if (infoIcon && tooltip) {
      infoIcon.addEventListener("click", () => {
        tooltip.classList.toggle("show");
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".reserve-wrapper")) {
          tooltip.classList.remove("show");
        }
      });
    }

    // --------- SAVE BUTTON ----------
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";

        try {
          await handleSave();
        } catch (err) {
          console.error("Save failed:", err);
          alert("❌ Error saving. Please try again.");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
        }
      };
    }

    // --------- PAYPAL REDIRECT BUTTON ----------
    const payBtn = document.getElementById("paypalBtn");
    if (payBtn) {
      payBtn.onclick = () => {
        const blockId = hiddenBlockNumber.value;
        if (!blockId) return alert("No block selected.");
        localStorage.setItem("pendingBlockId", blockId);
        window.location.href =
          `https://vaultoftime.com/paypal/pay.php?block=${blockId}`;
      };
    }

    // --------- ACCORDION (ABOUT / PRICING / LEGEND) ----------
    document.querySelectorAll(".accordion-header").forEach((header) => {
      if (header.tagName.toLowerCase() === "a") return;

      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        if (!content || !content.classList.contains("accordion-content")) return;

        const already = header.classList.contains("active");

        document
          .querySelectorAll(".accordion-header")
          .forEach((h) => h.classList.remove("active"));
        document
          .querySelectorAll(".accordion-content")
          .forEach((c) => c.classList.remove("show"));

        if (!already) {
          header.classList.add("active");
          content.classList.add("show");
        }
      });
    });

    // --------- INIT ----------
    await handlePaypalReturn();
    await loadClaimedBlocks();
    renderPage(currentPage);

  } catch (err) {
    console.error("FATAL Vault init error:", err);
    alert("An error occurred. Please refresh.");
  }

  hideLoader();
});
