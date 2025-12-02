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
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

let currentPage = 1;
let claimed = [];
let reservedBlocks = [];   // ⬅️ NEW
let blockCache = {};


// === LOAD CLAIMED BLOCKS ==============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);

    claimed = [];
    reservedBlocks = [];
    blockCache = {};

  snap.docs.forEach(async (d) => {
  const idNum = Number(d.id);
  const data = d.data();
  if (!data) return;

  blockCache[idNum] = data;
  // === AUTO-RELEASE EXPIRED RESERVATIONS ===
  if (data.reserved === true && data.reservedAt) {
    const now = Date.now();
    const reservedTime = data.reservedAt.toMillis(); // Firestore timestamp → ms

    const fifteenMinutes = 15 * 60 * 1000;

    // If reservation expired, clear it
    if (now - reservedTime > fifteenMinutes) {
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
    blockCache[idNum] = data;
  }

  else if (data.reserved === true) {
    reservedBlocks.push(idNum);
    blockCache[idNum] = data;
  }

});   // ← loop is finished RIGHT HERE

// ⬇️ NOW ADD THESE HERE (after the loop)
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


// === FETCH SINGLE BLOCK ===============================
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}


// === LOADER ===========================================
function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  // Slight delay so the loader feels intentional
  setTimeout(() => {
    if (loader) {
      loader.style.opacity = 0;
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 400);
    }
    if (main) main.classList.add("vault-main-visible");
  }, 1600);
}


// === DOM READY ========================================
document.addEventListener("DOMContentLoaded", async () => {

  // MENU TOGGLE
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

  // Make header title clickable back to home
  const headerTitle = document.querySelector(".vault-title");
  if (headerTitle) {
    headerTitle.style.cursor = "pointer";
    headerTitle.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  try {
    // DOM REFERENCES
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

    if (!grid) {
      alert("Vault error: grid container missing.");
      return;
    }

    // LIVE MESSAGE COUNTER
    if (messageInput && messageCounter) {
      messageInput.addEventListener("input", () => {
        messageCounter.textContent =
          `${messageInput.value.length}/${MAX_MESSAGE_LENGTH}`;
      });
    }

    // SEARCH
    const highlightBlock = (num) => {
      const blocks = [...document.querySelectorAll(".block")];
      const target = blocks.find((b) => Number(b.textContent) === num);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("search-highlight");
      setTimeout(() => target.classList.remove("search-highlight"), 2000);
    };

    const searchBlock = () => {
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

    // VALIDATION
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


    // PAYPAL RETURN HANDLER
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


    // SAVE PENDING DATA (NO PAYMENT YET)
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

        readyMsg.classList.remove("hidden");
        paymentButtons.classList.remove("hidden");
        const payLink = document.getElementById("externalPayBtn");
        payLink.href = `https://www.paypal.com/ncp/payment/T9TZLXDZ6CLSE?block=${blockId}`;

      } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed.");
      }
    };


    // PAGINATION
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

    const changePage = (page) => {
      currentPage = page;
      renderPage(page);
    };

    // === RESERVE BLOCK ======================================
async function reserveBlock(blockId, userEmail) {
  try {
    const blockRef = doc(blocksCollection, String(blockId));
    const snap = await getDoc(blockRef);

    // If already paid, prevent reservation
    if (snap.exists() && snap.data().status === "paid") {
      alert("This block is already purchased.");
      return false;
    }

    // If someone else reserved it, prevent reservation
    if (snap.exists() && snap.data().reserved === true) {
      alert("Someone else has reserved this block. Try another.");
      return false;
    }

    // Reserve it
    await setDoc(
      blockRef,
      {
        reserved: true,
        reservedBy: userEmail,
        reservedAt: serverTimestamp()
      },
      { merge: true }
    );

    alert("Block reserved for 15 minutes! Complete your purchase.");
    return true;

  } catch (err) {
    console.error("Reservation error:", err);
    alert("Could not reserve block. Try again.");
    return false;
  }
}

    // RENDER PAGE ======================================================
    const renderPage = (pageNum) => {
      grid.innerHTML = "";

      const start = (pageNum - 1) * PAGE_SIZE + 1;
      const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

      for (let i = start; i <= end; i++) {
        const div = document.createElement("div");
        div.className = "block";
        div.textContent = i;
        // === RESERVED BLOCKS ===
if (reservedBlocks.includes(i)) {
  const data = blockCache[i];
  const reservedBy = data?.reservedBy || null;

  const savedEmail = localStorage.getItem("userEmail");
const userEmail = emailInput?.value?.trim() || savedEmail || null;

  // If THIS USER reserved it → allow clicking
  if (userEmail && reservedBy === userEmail) {
    div.classList.add("reserved-owner");
    div.textContent = `${i} (Your Reserved Block)`;
    // Let them open modal to upload/save
    // (behave as normal unclaimed block)
  } else {
    // Someone else reserved it → block access
    div.classList.add("reserved");
    div.textContent = `${i} (R)`;
    div.onclick = () => alert("Someone else has reserved this block.");
    grid.appendChild(div);
    continue;
  }
}
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

        // CLICK HANDLER FOR EACH BLOCK
        div.onclick = async () => {
          // --- RESET MODAL STATE ---
const warning = document.getElementById("reservedWarning");
if (warning) warning.classList.add("hidden");

const uploadBtn = document.getElementById("uploadBtn");
if (uploadBtn) {
  uploadBtn.disabled = false;
  uploadBtn.style.opacity = "1";
}

// Restore saved email into input (but do NOT overwrite it later)
const savedEmail = localStorage.getItem("userEmail");
if (savedEmail && emailInput && !emailInput.value.trim()) {
  emailInput.value = savedEmail;
}
          // === RESERVED BLOCK HANDLING ===
if (reservedBlocks.includes(i)) {
  const data = blockCache[i];
  const reservedBy = data?.reservedBy || null;

  const savedEmail = localStorage.getItem("userEmail");
  const userEmail = emailInput?.value?.trim() || savedEmail || null;

  // RESERVED BLOCK HANDLING — FINAL VERSION
if (reservedBlocks.includes(i)) {
  const data = blockCache[i];
  const reservedBy = data?.reservedBy || null;

  const savedEmail = localStorage.getItem("userEmail");
  const typedEmail = emailInput?.value?.trim() || null;
  const userEmail = typedEmail || savedEmail;

  // If THIS user reserved the block → allow normal flow
  if (userEmail && reservedBy === userEmail) {
    // continue to claimed/unclaimed logic below
  } else {
    // Show warning modal + disable uploading
    modal.classList.remove("hidden");

    const warning = document.getElementById("reservedWarning");
    if (warning) warning.classList.remove("hidden");

    hiddenBlockNumber.value = i;

    const selectedText = document.getElementById("selected-block-text");
    if (selectedText) {
      selectedText.textContent = `Block #${i} (Reserved by another user)`;
    }

    document.getElementById("uploadBtn").disabled = true;
    document.getElementById("uploadBtn").style.opacity = "0.5";

    return;
  }
}
          // VIEW CLAIMED BLOCK (no badges)
if (claimed.includes(i)) {
  const data = await fetchBlock(i);

  // Title
  const titleEl = document.getElementById("viewBlockTitle");
  if (titleEl) titleEl.textContent = `Block #${i}`;

  // Message
  const msgEl = document.getElementById("viewBlockMessage");
  if (msgEl) msgEl.textContent = data?.message || "";

  // Media
  const mediaEl = document.getElementById("viewBlockMedia");
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

  // Show modal
  viewModal.classList.remove("hidden");
  return;
}

          // SELECT NEW BLOCK (UNCLAIMED)
          document.querySelectorAll(".block").forEach((b) =>
            b.classList.remove("selected")
          );
          div.classList.add("selected");

          hiddenBlockNumber.value = i;

          const selectedText = document.getElementById("selected-block-text");
          if (selectedText)
            selectedText.textContent = `Selected Block: #${i}`;
// RESET reserved warning + enable upload button
const warning = document.getElementById("reservedWarning");
if (warning) warning.classList.add("hidden");

const uploadBtn = document.getElementById("uploadBtn");
if (uploadBtn) {
  uploadBtn.disabled = false;
  uploadBtn.style.opacity = "1";
}
          modal.classList.remove("hidden");
        };

        grid.appendChild(div);
      }

      renderPagination();
    };


    // CLOSE MODALS
    if (viewClose) viewClose.onclick = () => viewModal.classList.add("hidden");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");

    // RULES ACK
    if (ackBtn && banner) {
      ackBtn.addEventListener("click", () => {
        banner.classList.add("hidden");
        document.body.classList.remove("no-scroll");
      });
    }

    // EVENTS
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

      //STORE EMAIL for future access (the FIX!)
      localStorage.setItem("userEmail", userEmail);
      
      modal.classList.add("hidden");
      await loadClaimedBlocks();
      renderPage(currentPage);
    }
  };
}
    // === TOOLTIP FOR RESERVE BUTTON ===
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

    // PAYPAL REDIRECT BUTTON (if used separately)
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

    // INIT
    await handlePaypalReturn();
    await loadClaimedBlocks();
    renderPage(currentPage);

  } catch (err) {
    console.error("FATAL Vault init error:", err);
    alert("An error occurred. Please refresh.");
  }

  hideLoader();

}); // END DOMContentLoaded


// ACCORDION LOGIC (SKIP LEGEND LINK)
document.querySelectorAll(".accordion-header").forEach((header) => {
  // If it's the Legend <a>, let the link behave normally
  if (header.tagName.toLowerCase() === "a") return;

  header.addEventListener("click", () => {
    const content = header.nextElementSibling;
    if (!content || !content.classList.contains("accordion-content")) return;

    const already = header.classList.contains("active");

    document.querySelectorAll(".accordion-header")
      .forEach((h) => h.classList.remove("active"));
    document.querySelectorAll(".accordion-content")
      .forEach((c) => c.classList.remove("show"));

    if (!already) {
      header.classList.add("active");
      content.classList.add("show");
    }
  });
});
