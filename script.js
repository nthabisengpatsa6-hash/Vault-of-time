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
let reserved = [];   // ⬅️ NEW
let blockCache = {};


// === LOAD CLAIMED BLOCKS ==============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);

    claimed = [];
    reserved = [];
    blockCache = {};

    snap.docs.forEach((d) => {
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
    reserved.push(idNum);
    blockCache[idNum] = data;
  }

});   // ← loop is finished RIGHT HERE

// ⬇️ NOW ADD THESE HERE (after the loop)
localStorage.setItem("claimed", JSON.stringify(claimed));
localStorage.setItem("reserved", JSON.stringify(reserved));

console.log(
  "Loaded → Claimed:",
  claimed.length,
  "Reserved:",
  reserved.length
);

  } catch (err) {
    console.error("Error loading block states:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
    reserved = JSON.parse(localStorage.getItem("reserved") || "[]");
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
        // Reserved (but not yet paid)
if (reserved.includes(i)) {
  div.classList.add("reserved");
  div.textContent = `${i} (R)`; // optional visual cue
  div.onclick = () => alert("This block is temporarily reserved.");
  grid.appendChild(div);
  continue; // skip rest of loop
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
          // VIEW CLAIMED BLOCK
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);

            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");
            const badgeBox = document.getElementById("viewBlockBadge");

            if (titleEl) titleEl.textContent = `Block #${i}`;

            // BADGES
            let badgeSvg = "";

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

            const badge3 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="50" stroke="#D4AF37" stroke-width="3"/>
  <rect x="38" y="30" width="8" height="60" fill="#D4AF37" opacity="0.3"/>
  <rect x="74" y="30" width="8" height="60" fill="#D4AF37" opacity="0.3"/>
  <path d="M60 35 L85 55 L75 90 L45 90 L35 55 Z" fill="#D4AF37"/>
  <path d="M60 45 L70 60 L60 75 L50 60 Z" fill="#1A1A1A" opacity="0.3"/>
  <path d="M60 50 C65 55 62 65 60 68 C58 65 55 55 60 50Z" fill="#00D4FF"/>
</svg>`;

            const badge4 = `
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,15 100,60 60,105 20,60" stroke="#D4AF37" stroke-width="3" fill="none"/>
  <path d="M45 70 Q60 85 75 70" stroke="#D4AF37" stroke-width="3" fill="none"/>
  <path d="M60 55 C70 65 62 80 60 83 C58 80 50 65 60 55Z" fill="#D4AF37"/>
  <path d="M60 58 C66 64 63 73 60 75 C57 73 54 64 60 58Z" fill="#00D4FF"/>
  <circle cx="60" cy="40" r="4" fill="#D4AF37"/>
</svg>`;

            if (i >= 1 && i <= 25000) badgeSvg = badge1;
            else if (i <= 50000) badgeSvg = badge2;
            else if (i <= 75000) badgeSvg = badge3;
            else if (i <= 100000) badgeSvg = badge4;

            if (badgeBox) badgeBox.innerHTML = badgeSvg;

            // MEDIA
            const mediaUrl = data?.mediaUrl || data?.imageUrl;
            const mediaType = data?.mediaType;

            if (mediaEl) {
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

            if (msgEl) msgEl.textContent = data?.message || "";

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
      modal.classList.add("hidden");
      await loadClaimedBlocks();
      renderPage(currentPage);
    }
  };
}
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
