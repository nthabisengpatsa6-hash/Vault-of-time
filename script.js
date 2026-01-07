// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
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

// ================= GLOBAL CONFIG & STATE ====================
const TOTAL_BLOCKS = 100000;
const PAGE_SIZE = 500;
const MAX_MESSAGE_LENGTH = 300;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

let isMultiSelect = false;
let selectedBatch = [];
let lastClickedId = null;
let loggedInUserEmail = null;
let rangeStartId = null;
let currentPage = 1;
let claimed = [];
let reservedBlocks = [];
let blockCache = {};

// ================= UI GLOBALS (Defined here, Assigned in Init) =================
// We declare these here so ALL functions can see them.
let grid, pagination, modal, viewModal;
let nameInput, emailInput, messageInput, messageCounter, fileInput;
let modalCloseBtn, viewCloseBtn, readyMsg, paymentButtons;
let banner, ackBtn, searchInput, searchBtn, saveBtn, hiddenBlockNumber;
let reserveBtn, payBtn;
let bulkBar, bulkCount, markStartBtn, bulkReserveBtn, multiSelectToggle;
let loginModal, menuLoginBtn, closeLogin;
let loginStep1, loginStep2, loginEmailInput, loginSendBtn, loginCodeInput, loginConfirmBtn;
let loginGeneratedCode = null;

// ================= KEEPER'S MEMORY CHECK =================
const sessionData = localStorage.getItem('vault_session');
if (sessionData) {
  const session = JSON.parse(sessionData);
  if (Date.now() < session.expiresAt) {
    loggedInUserEmail = session.email;
    setTimeout(() => {
      const loginBtn = document.getElementById('menuLoginBtn');
      if (loginBtn) {
        loginBtn.innerHTML = "👤 " + session.email;
        loginBtn.style.color = "#4CAF50";
      }
    }, 200);
    console.log("Vault Session Restored for:", session.email);
  } else {
    localStorage.removeItem('vault_session');
  }
}

// ================= CORE FUNCTIONS =================

// 1. Show/Hide Bulk Bar
function updateBulkBar() {
  if (!bulkBar || !bulkCount) return;
  if (selectedBatch.length > 0) {
    bulkBar.classList.remove("hidden");
    bulkBar.style.display = "flex";
    bulkCount.textContent = `${selectedBatch.length} Blocks Selected`;
  } else {
    bulkCount.textContent = "0 Blocks Selected";
  }
}

// 2. Load Data
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

      // Auto-release logic
      if (data.reserved === true && data.reservedAt && data.status !== "paid") {
        const now = Date.now();
        const reservedTime = data.reservedAt.toMillis();
        let timeLimit = 30 * 60 * 1000; // 30 mins
        if (data.isBulk === true) timeLimit = 1440 * 60 * 1000; // 24 hours

        if (now - reservedTime > timeLimit) {
          console.log("Auto-releasing:", idNum);
          await setDoc(doc(blocksCollection, String(idNum)), {
            reserved: false, reservedBy: null, reservedAt: null, isBulk: null,
            reservedName: null, status: "available"
          }, { merge: true });
          data.reserved = false;
        }
      }

      if (data.status === "paid") claimed.push(idNum);
      else if (data.reserved === true) reservedBlocks.push(idNum);
      blockCache[idNum] = data;
    }

    localStorage.setItem("claimed", JSON.stringify(claimed));
    localStorage.setItem("reservedBlocks", JSON.stringify(reservedBlocks));
    console.log("Loaded → Claimed:", claimed.length, "Reserved:", reservedBlocks.length);
  } catch (err) {
    console.error("Error loading block states:", err);
    claimed = JSON.parse(localStorage.getItem("claimed") || "[]");
    reservedBlocks = JSON.parse(localStorage.getItem("reservedBlocks") || "[]");
  }
}

async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

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

// 3. Validation
const valid = () => {
  if (!hiddenBlockNumber.value) return false;
  if (!nameInput.value.trim()) return false;
  if (!emailInput.value.trim()) return false;
  if (!fileInput.files.length) return false;
  if (messageInput.value.length > MAX_MESSAGE_LENGTH) {
    alert("Message too long."); return false;
  }
  const file = fileInput.files[0];
  const type = file.type || "";
  if (!type.startsWith("image/") && !type.startsWith("audio/")) {
    alert("Upload an image or audio file."); return false;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert("File too large (max 2MB)."); return false;
  }
  return true;
};

// 4. Save & Upload
const handleSave = async () => {
  if (!valid()) return;
  const blockId = hiddenBlockNumber.value;

  try {
    const file = fileInput.files[0];
    const isImg = file.type.startsWith("image/");
    const isAud = file.type.startsWith("audio/");
    const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const mediaUrl = await getDownloadURL(fileRef);

    await setDoc(doc(blocksCollection, blockId), {
      blockNumber: Number(blockId),
      message: messageInput.value,
      mediaUrl,
      mediaType: isAud ? "audio" : "image",
      imageUrl: isImg ? mediaUrl : null,
      audioUrl: isAud ? mediaUrl : null,
      status: "pending",
      purchasedAt: null
    });

    await savePrivateSale(blockId, emailInput.value, nameInput.value);

    localStorage.setItem("pendingBlockId", blockId);
    if (readyMsg) readyMsg.classList.remove("hidden");
    if (paymentButtons) paymentButtons.classList.remove("hidden");

    const payLink = document.getElementById("externalPayBtn");
    if (payLink) payLink.href = `https://www.paypal.com/ncp/payment/T9TZLXDZ6CLSE?block=${blockId}`;

  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed.");
  }
};

// 5. Reservation Logic
const reserveBlock = async (blockId, userEmail) => {
  try {
    const blockRef = doc(blocksCollection, String(blockId));
    const snap = await getDoc(blockRef);
    if (snap.exists() && snap.data().status === "paid") {
      alert("This block is already purchased."); return false;
    }
    if (snap.exists() && snap.data().reserved === true) {
      alert("Someone else has reserved this block."); return false;
    }
    await setDoc(blockRef, {
      reserved: true, reservedBy: userEmail, reservedAt: serverTimestamp()
    }, { merge: true });

    alert("Block reserved for 30 minutes! Complete your purchase.");
    return true;
  } catch (err) {
    console.error("Reservation error:", err);
    alert("Could not reserve block.");
    return false;
  }
};

async function executeBulkReservation() {
  if (!selectedBatch || selectedBatch.length === 0) return;
  const name = prompt("Please enter your Name for the quote:");
  if (!name) return;
  const email = prompt("Please enter your Email address for the quote:");
  if (!email) return;

  const originalText = bulkReserveBtn ? bulkReserveBtn.textContent : "Reserve All";
  if (bulkReserveBtn) { bulkReserveBtn.textContent = "Processing..."; bulkReserveBtn.disabled = true; }

  try {
    const promises = selectedBatch.map(blockId => {
      return setDoc(doc(blocksCollection, String(blockId)), {
        reserved: true, reservedBy: email, reservedName: name,
        reservedAt: serverTimestamp(), isBulk: true, status: "pending_quote"
      }, { merge: true });
    });

    await Promise.all(promises);

    const serviceID = "service_pmuwoaa";
    const templateID = "template_xraan78";
    const emailParams = {
      name: name, email: email, block_count: selectedBatch.length,
      total_cost: selectedBatch.length * 6, block_list: selectedBatch.join(", ")
    };

    await emailjs.send(serviceID, templateID, emailParams);
    alert(`SUCCESS! Blocks reserved. Check your email for the quote!`);
    location.reload();

  } catch (err) {
    console.error("Bulk reserve error:", err);
    alert("Something went wrong.");
    if (bulkReserveBtn) { bulkReserveBtn.textContent = originalText; bulkReserveBtn.disabled = false; }
  }
}

// 6. UI Rendering & Click Handling
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

const renderPage = (pageNum) => {
  if (!grid) return;
  grid.innerHTML = "";
  const start = (pageNum - 1) * PAGE_SIZE + 1;
  const end = Math.min(start + PAGE_SIZE - 1, TOTAL_BLOCKS);

  // Update Chapter Text
  const chapterNameDisplay = document.getElementById("chapterName");
  const chapterRangeDisplay = document.getElementById("chapterRange");
  let districtTitle = "";
  if (pageNum <= 50) districtTitle = "THE ARENA: Sports & GOATs";
  else if (pageNum <= 80) districtTitle = "THE BOULEVARD: Iconic Brands";
  else if (pageNum <= 110) districtTitle = "THE LOBBY: Gaming & Tech";
  else if (pageNum <= 160) districtTitle = "THE STAGE: Culture & Amapiano";
  else districtTitle = "THE PLAZA: Personal Legacies";

  if (chapterNameDisplay) chapterNameDisplay.textContent = districtTitle;
  if (chapterRangeDisplay) chapterRangeDisplay.textContent = `Blocks ${start} – ${end}`;
  updateKeeper(pageNum);

  for (let i = start; i <= end; i++) {
    const div = document.createElement("div");
    div.className = "block";
    div.textContent = i;
    div.dataset.blockId = i;

    // Appearance Logic
    if (reservedBlocks.includes(i)) {
      const data = blockCache[i];
      const reservedBy = data?.reservedBy || null;
      const savedEmail = localStorage.getItem("userEmail");
      const userEmail = (emailInput?.value && emailInput.value.trim()) || savedEmail || null;

      if (userEmail && reservedBy === userEmail) {
        div.classList.add("reserved-owner");
        div.textContent = `${i} (Your Reserved Block)`;
      } else {
        div.classList.add("reserved");
        div.textContent = `${i} (R)`;
      }
    }

    if (claimed.includes(i)) {
      div.classList.add("claimed");
      const data = blockCache[i];
      const mediaUrl = data?.mediaUrl || data?.imageUrl;
      const mediaType = data?.mediaType || (data?.imageUrl ? "image" : data?.audioUrl ? "audio" : null);

      if (mediaUrl && mediaType === "image") {
        div.classList.add("claimed-has-image");
        div.style.backgroundImage = `url(${mediaUrl})`;
        div.style.backgroundSize = "cover";
        div.style.backgroundPosition = "center";
        div.style.color = "transparent";
      } else if (mediaUrl && mediaType === "audio") {
        div.classList.add("claimed-has-audio");
      } else {
        div.classList.add("claimed-empty");
      }
    }

    // Click Handler
    div.onclick = async () => {
      // Reset UI
      const form = document.getElementById("blockForm");
      const lockedMsg = document.getElementById("lockedMsg");
      const warning = document.getElementById("reservedWarning");
      const selectedText = document.getElementById("selected-block-text");

      if (form) form.classList.remove("locked-form");
      if (lockedMsg) lockedMsg.classList.add("hidden");
      if (warning) warning.classList.add("hidden");
      if (saveBtn) {
        saveBtn.disabled = false; saveBtn.style.opacity = "1"; saveBtn.style.display = "block"; saveBtn.textContent = "Save Details";
      }

      // Multi-Select
      if (isMultiSelect) {
        if (claimed.includes(i)) return alert("This block is already purchased.");
        if (reservedBlocks.includes(i)) {
          const data = blockCache[i];
          const savedEmail = localStorage.getItem("userEmail");
          if (!data || data.reservedBy !== savedEmail) return alert("Reserved by another user.");
        }

        if (window.event.shiftKey && lastClickedId !== null) {
          const s = Math.min(lastClickedId, i);
          const e = Math.max(lastClickedId, i);
          for (let k = s; k <= e; k++) {
            if (claimed.includes(k)) continue;
            if (!selectedBatch.includes(k)) {
              if (selectedBatch.length >= 500) break;
              selectedBatch.push(k);
              const el = document.querySelector(`.block[data-block-id='${k}']`);
              if (el) el.classList.add("multi-selected");
            }
          }
        } else {
          if (rangeStartId !== null) {
            selectedBatch = [];
            document.querySelectorAll(".block").forEach(b => b.classList.remove("multi-selected"));
            selectedBatch.push(rangeStartId, i);
            div.classList.add("multi-selected");
            const startEl = document.querySelector(`.block[data-block-id='${rangeStartId}']`);
            if (startEl) startEl.classList.add("multi-selected");
            bulkReserveBtn.textContent = `Reserve Range (${Math.abs(rangeStartId - i) + 1} Blocks)`;
          } else {
            if (selectedBatch.includes(i)) {
              selectedBatch = selectedBatch.filter(id => id !== i);
              div.classList.remove("multi-selected");
            } else {
              if (selectedBatch.length >= 500) return alert("Max 500 blocks.");
              selectedBatch.push(i);
              div.classList.add("multi-selected");
            }
          }
          lastClickedId = i;
        }
        updateBulkBar();
        return;
      }

      // Single Block Logic
      if (claimed.includes(i)) {
        const data = await fetchBlock(i);
        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        div.classList.add("selected");
        hiddenBlockNumber.value = i;
        if (selectedText) selectedText.textContent = `Managing Legacy: Block #${i}`;

        const ownerEmail = data?.reservedBy || data?.email;
        const isOwner = loggedInUserEmail && ownerEmail && (loggedInUserEmail.toLowerCase() === ownerEmail.toLowerCase());

        if (saveBtn) {
          if (isOwner) {
            saveBtn.textContent = "🚀 Update Grid Image";
            saveBtn.onclick = () => handleKeeperUpdate(i);
          } else {
            saveBtn.style.display = "none";
            if (lockedMsg) {
              lockedMsg.textContent = "This legacy is anchored. View Only mode.";
              lockedMsg.classList.remove("hidden");
            }
          }
        }
        modal.classList.remove("hidden");
        return;
      }

      if (reservedBlocks.includes(i)) {
        const data = blockCache[i];
        const reservedBy = data?.reservedBy || null;
        const userEmail = loggedInUserEmail || emailInput?.value?.trim() || localStorage.getItem("userEmail");

        if (!userEmail || !reservedBy || userEmail.toLowerCase() !== reservedBy.toLowerCase()) {
          if (selectedText) selectedText.textContent = `Block #${i} (Reserved)`;
          if (lockedMsg) lockedMsg.classList.remove("hidden");
          if (saveBtn) saveBtn.style.display = "none";
          modal.classList.remove("hidden");
          return;
        }
      }

      // Available
      document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
      div.classList.add("selected");
      hiddenBlockNumber.value = i;
      if (nameInput) nameInput.classList.remove("hidden");
      if (emailInput) emailInput.classList.remove("hidden");
      if (reserveBtn) reserveBtn.classList.remove("hidden");
      if (saveBtn) saveBtn.style.display = "block";
      if (selectedText) selectedText.textContent = `Selected Block: #${i}`;
      modal.classList.remove("hidden");
    };
    grid.appendChild(div);
  }
  renderPagination();
};

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

// 7. Aux Functions
async function handleKeeperUpdate(blockId) {
  const fileInput = document.getElementById("fileUpload");
  const saveBtn = document.getElementById("uploadBtn");
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("⚠️ Please select a new image file first."); return;
  }
  const file = fileInput.files[0];
  if (!file.type.startsWith("image/")) {
    alert("❌ Only image files can be displayed on the grid."); return;
  }
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true; saveBtn.textContent = "Uploading...";
  try {
    const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const mediaUrl = await getDownloadURL(fileRef);
    const blockRef = doc(db, "blocks", String(blockId));
    await updateDoc(blockRef, { imageUrl: mediaUrl, mediaUrl: mediaUrl, mediaType: "image", status: "paid", updatedAt: serverTimestamp() });
    alert("✅ Legacy Updated!"); location.reload();
  } catch (err) {
    console.error("Update failed:", err); alert("❌ Update failed: " + err.message);
    saveBtn.disabled = false; saveBtn.textContent = originalText;
  }
}

async function savePrivateSale(blockID, email, name) {
  try {
    await addDoc(collection(db, 'sales_records'), { blockID, customerEmail: email, customerName: name, purchasedAt: serverTimestamp() });
  } catch (e) { console.error("Vault save failed", e); }
}

function updateKeeper(pageNum) {
  const keeperText = document.getElementById("keeper-text");
  const keeperTitle = document.getElementById("keeper-title");
  if (keeperText && keeperTitle) {
    let title = "Plaza Mayor";
    let content = "THE PLAZA. Tell the future you were here.";
    if (pageNum <= 50) { title = "Arena Guide"; content = "Welcome to THE ARENA."; }
    else if (pageNum <= 80) { title = "Boulevard Scout"; content = "Welcome to THE BOULEVARD."; }
    else if (pageNum <= 110) { title = "Lobby Admin"; content = "You've entered THE LOBBY."; }
    else if (pageNum <= 160) { title = "Stage Manager"; content = "THE STAGE is vibrating."; }
    keeperTitle.innerText = `The Keeper: ${title}`;
    keeperText.innerText = content;
  }
}

const handlePaypalReturn = async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("paid") !== "true") return;
  const pendingBlockId = localStorage.getItem("pendingBlockId");
  if (!pendingBlockId) return;
  try {
    await setDoc(doc(blocksCollection, pendingBlockId), { status: "paid", purchasedAt: serverTimestamp() }, { merge: true });
    const numId = Number(pendingBlockId);
    if (!claimed.includes(numId)) {
      claimed.push(numId); localStorage.setItem("claimed", JSON.stringify(claimed));
    }
    const snap = await getDoc(doc(blocksCollection, pendingBlockId));
    if (snap.exists()) blockCache[numId] = snap.data();
    localStorage.removeItem("pendingBlockId");
    alert("Payment received! 🎉 Your block is sealed.");
  } catch (err) {
    console.error("Error finalising PayPal:", err); alert("Payment received but an error occurred.");
  }
};

// ================= INITIALIZATION (The Main Event) =================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Vault of Time: Initializing...");

  // 1. Assign DOM Elements
  grid = document.getElementById("grid");
  pagination = document.getElementById("pagination");
  modal = document.getElementById("modal");
  viewModal = document.getElementById("viewModal");
  nameInput = document.getElementById("name");
  emailInput = document.getElementById("email");
  messageInput = document.getElementById("message");
  messageCounter = document.getElementById("messageCounter");
  fileInput = document.getElementById("fileUpload");
  modalCloseBtn = document.querySelector(".close-button");
  viewCloseBtn = document.querySelector(".close-view");
  readyMsg = document.getElementById("ready-message");
  paymentButtons = document.getElementById("paymentButtons");
  banner = document.getElementById("rules-banner");
  ackBtn = document.getElementById("acknowledgeBtn");
  searchInput = document.getElementById("blockSearch");
  searchBtn = document.getElementById("searchBtn");
  saveBtn = document.getElementById("uploadBtn");
  hiddenBlockNumber = document.getElementById("blockNumber");
  bulkBar = document.getElementById("bulkActionBar");
  bulkCount = document.getElementById("bulkCount");
  markStartBtn = document.getElementById("markStartBtn");
  bulkReserveBtn = document.getElementById("bulkReserveBtn");
  multiSelectToggle = document.getElementById("multiSelectMode");
  loginModal = document.getElementById("loginModal");
  menuLoginBtn = document.getElementById("menuLoginBtn");
  closeLogin = document.querySelector(".close-login");
  loginStep1 = document.getElementById("loginStep1");
  loginStep2 = document.getElementById("loginStep2");
  loginEmailInput = document.getElementById("loginEmailInput");
  loginSendBtn = document.getElementById("loginSendBtn");
  loginCodeInput = document.getElementById("loginCodeInput");
  loginConfirmBtn = document.getElementById("loginConfirmBtn");
  reserveBtn = document.getElementById("reserveBtn");
  payBtn = document.getElementById("paypalBtn");

  // 2. Attach Event Listeners
  if (menuLoginBtn) {
    menuLoginBtn.addEventListener("click", () => {
      if (loggedInUserEmail) return alert("Already logged in as: " + loggedInUserEmail);
      const sideMenu = document.getElementById("sideMenu");
      if (sideMenu) sideMenu.classList.remove("open");
      if (loginModal) loginModal.classList.remove("hidden");
      if (loginStep1) loginStep1.classList.remove("hidden");
      if (loginStep2) loginStep2.classList.add("hidden");
    });
  }
  if (closeLogin) closeLogin.onclick = () => loginModal.classList.add("hidden");

  if (loginSendBtn) {
    loginSendBtn.onclick = async () => {
      const email = loginEmailInput.value.trim();
      if (!email) return alert("Enter your email.");
      loginSendBtn.textContent = "Sending..."; loginSendBtn.disabled = true;
      try {
        loginGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
        await emailjs.send("service_pmuwoaa", "template_ifxwqp6", { email: email, code: loginGeneratedCode });
        alert("Code sent! Check your inbox.");
        loginStep1.classList.add("hidden"); loginStep2.classList.remove("hidden");
      } catch (err) {
        console.error(err); alert("Error sending code.");
        loginSendBtn.textContent = "Send Login Code"; loginSendBtn.disabled = false;
      }
    };
  }

  if (loginConfirmBtn) {
    loginConfirmBtn.onclick = () => {
      if (loginCodeInput.value.trim() === loginGeneratedCode) {
        loggedInUserEmail = loginEmailInput.value.trim().toLowerCase();
        const session = { email: loggedInUserEmail, expiresAt: Date.now() + 21600000 };
        localStorage.setItem('vault_session', JSON.stringify(session));
        alert("✅ Login Successful!");
        loginModal.classList.add("hidden");
        if (menuLoginBtn) { menuLoginBtn.innerHTML = "👤 " + loggedInUserEmail; menuLoginBtn.style.color = "#4CAF50"; }
      } else alert("❌ Incorrect code.");
    };
  }

  if (messageInput && messageCounter) {
    messageInput.addEventListener("input", () => { messageCounter.textContent = `${messageInput.value.length}/${MAX_MESSAGE_LENGTH}`; });
  }

  if (multiSelectToggle) {
    multiSelectToggle.addEventListener("change", (e) => {
      isMultiSelect = e.target.checked;
      selectedBatch = [];
      document.querySelectorAll(".block").forEach(b => b.classList.remove("multi-selected"));
      if (isMultiSelect) {
        if (bulkBar) { bulkBar.style.display = "flex"; bulkBar.classList.remove("hidden"); }
        if (markStartBtn) { markStartBtn.textContent = '1. Mark Start'; markStartBtn.style.borderColor = '#D4AF37'; markStartBtn.style.color = '#D4AF37'; }
        if (bulkReserveBtn) bulkReserveBtn.textContent = 'Reserve All';
      } else {
        if (bulkBar) { bulkBar.classList.add("hidden"); bulkBar.style.display = "none"; }
      }
      updateBulkBar();
    });
  }

  if (markStartBtn) {
    markStartBtn.addEventListener("click", () => {
      if (selectedBatch.length === 0) return alert("Please select the starting block first.");
      rangeStartId = selectedBatch[0];
      markStartBtn.textContent = `2. Select Range (Start: #${rangeStartId})`;
      markStartBtn.style.borderColor = '#4CAF50'; markStartBtn.style.color = '#4CAF50';
      bulkReserveBtn.textContent = '3. Confirm Reservation';
      alert(`Starting block marked: #${rangeStartId}. Now tap the final block.`);
    });
  }

  if (bulkReserveBtn) {
    bulkReserveBtn.addEventListener("click", async () => {
      if (rangeStartId !== null) {
        const rangeEndId = selectedBatch.length > 0 ? selectedBatch[selectedBatch.length - 1] : rangeStartId;
        if (rangeStartId === rangeEndId) return alert("Please tap the final block.");
        const start = Math.min(rangeStartId, rangeEndId);
        const end = Math.max(rangeStartId, rangeEndId);
        bulkReserveBtn.textContent = "Selecting..."; bulkReserveBtn.disabled = true;
        for (let k = start; k <= end; k++) {
          if (claimed.includes(k)) continue;
          if (!selectedBatch.includes(k)) {
            if (selectedBatch.length >= 500) break;
            selectedBatch.push(k);
            const el = document.querySelector(`.block[data-block-id='${k}']`);
            if (el) el.classList.add("multi-selected");
          }
        }
        updateBulkBar();
        rangeStartId = null;
        markStartBtn.textContent = '1. Mark Start'; markStartBtn.style.borderColor = '#D4AF37'; markStartBtn.style.color = '#D4AF37';
        bulkReserveBtn.textContent = 'Reserve All'; bulkReserveBtn.disabled = false;
        return executeBulkReservation();
      }
      return executeBulkReservation();
    });
  }

  if (searchBtn) searchBtn.onclick = searchBlock;
  if (reserveBtn) {
    reserveBtn.onclick = async () => {
      const blockId = hiddenBlockNumber.value;
      const userEmail = emailInput.value.trim();
      if (!blockId) return alert("No block selected.");
      if (!userEmail) return alert("Enter your email.");
      const success = await reserveBlock(blockId, userEmail);
      if (success) {
        localStorage.setItem("userEmail", userEmail);
        modal.classList.add("hidden");
        await loadClaimedBlocks();
        renderPage(currentPage);
      }
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try { await handleSave(); } catch (err) { console.error(err); alert("❌ Error saving."); }
      finally { saveBtn.disabled = false; saveBtn.textContent = originalText; }
    };
  }

  if (payBtn) {
    payBtn.onclick = () => {
      const blockId = hiddenBlockNumber.value;
      if (!blockId) return alert("No block selected.");
      localStorage.setItem("pendingBlockId", blockId);
      window.location.href = `https://vaultoftime.com/paypal/pay.php?block=${blockId}`;
    };
  }

  if (ackBtn && banner) {
    ackBtn.addEventListener("click", () => {
      banner.classList.add("hidden");
      document.body.classList.remove("no-scroll");
    });
  }

  if (modalCloseBtn) modalCloseBtn.onclick = () => modal.classList.add("hidden");
  if (viewCloseBtn && viewModal) viewCloseBtn.onclick = () => viewModal.classList.add("hidden");

  // Keeper Welcome & Chat
  const welcomeModal = document.getElementById("keeper-welcome-modal");
  if (welcomeModal && !localStorage.getItem("vaultKeeperMet")) welcomeModal.style.display = "flex";
  const welcomeCloseBtn = document.getElementById("close-keeper-welcome");
  if (welcomeCloseBtn) welcomeCloseBtn.onclick = () => { welcomeModal.style.display = "none"; localStorage.setItem("vaultKeeperMet", "true"); };

  const keeperBubble = document.getElementById("keeper-bubble");
  const triggerBtn = document.getElementById("keeper-trigger");
  if (triggerBtn && keeperBubble) triggerBtn.onclick = () => keeperBubble.style.display = keeperBubble.style.display === "none" ? "block" : "none";
  const keeperClose = document.getElementById("close-keeper-bubble");
  if (keeperClose) keeperClose.onclick = (e) => { e.stopPropagation(); keeperBubble.style.display = "none"; };

  // Menu
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");
  if (menuToggle) menuToggle.addEventListener("click", () => { if (sideMenu) sideMenu.classList.add("open"); if (overlay) overlay.classList.add("show"); });
  const closeMenuFn = () => { if (sideMenu) sideMenu.classList.remove("open"); if (overlay) overlay.classList.remove("show"); };
  if (closeMenu) closeMenu.addEventListener("click", closeMenuFn);
  if (overlay) overlay.addEventListener("click", closeMenuFn);

  // Home Header
  const headerTitle = document.querySelector(".vault-title");
  if (headerTitle) { headerTitle.style.cursor = "pointer"; headerTitle.addEventListener("click", () => window.location.href = "index.html"); }

  // Accordion
  document.querySelectorAll(".accordion-header").forEach((header) => {
    if (header.tagName.toLowerCase() === "a") return;
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      if (!content || !content.classList.contains("accordion-content")) return;
      const already = header.classList.contains("active");
      document.querySelectorAll(".accordion-header").forEach((h) => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach((c) => c.classList.remove("show"));
      if (!already) { header.classList.add("active"); content.classList.add("show"); }
    });
  });

  const infoIcon = document.querySelector(".reserve-info-icon");
  const tooltip = document.querySelector(".reserve-tooltip");
  if (infoIcon && tooltip) {
    infoIcon.addEventListener("click", () => tooltip.classList.toggle("show"));
    document.addEventListener("click", (e) => { if (!e.target.closest(".reserve-wrapper")) tooltip.classList.remove("show"); });
  }

  // 3. Execution (Start the app)
  await handlePaypalReturn();
  await loadClaimedBlocks();
  renderPage(currentPage);
  hideLoader();

});
