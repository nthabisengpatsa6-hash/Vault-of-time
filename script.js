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
  serverTimestamp, 
  query, 
  orderBy, 
  limit,
  where // <--- THIS IS THE CRITICAL ADDITION
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { 
  getAuth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  onAuthStateChanged, // Add this too, it's very helpful
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
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
const auth = getAuth(app);
// THE BRIDGE: Allowing the game to talk to your database
window.db = db;
window.FirebaseFirestore = { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp };

// THE ARCADE FUNCTIONS: Making the buttons work
window.openArcade = () => {
    const gameIframe = document.getElementById('gameIframe');
    const arcadeOverlay = document.getElementById('arcadeOverlay');
    
    if (gameIframe && arcadeOverlay) {
        gameIframe.src = 'game.html'; // Load the game only when opened
        arcadeOverlay.classList.remove('hidden');
        document.body.style.overflow = "hidden"; // Stop the grid from scrolling
    }
};

window.closeArcade = () => {
    const arcadeOverlay = document.getElementById('arcadeOverlay');
    const gameIframe = document.getElementById('gameIframe');

    if (arcadeOverlay) {
        arcadeOverlay.classList.add('hidden');
        if (gameIframe) gameIframe.src = ''; // Kill the game so the music stops
        document.body.style.overflow = "auto";
    }
};

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

// ================= UI GLOBALS =================
let grid, pagination, modal, viewModal;
let nameInput, emailInput, messageInput, messageCounter, fileInput;
let modalCloseBtn, viewCloseBtn, readyMsg, paymentButtons;
let banner, ackBtn, searchInput, searchBtn, saveBtn, hiddenBlockNumber;
let reserveBtn, payBtn;
let bulkBar, bulkCount, markStartBtn, bulkReserveBtn, multiSelectToggle;
let loginModal, menuLoginBtn, closeLogin;
let loginStep1, loginStep2, loginEmailInput, loginSendBtn, loginCodeInput, loginConfirmBtn;
let loginGeneratedCode = null;

// --- THE AUTH WATCHER ---
// This replaces your manual localStorage checks and handles the "Handshake"
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 1. Recognize the Keeper
    console.log("Vault Session Restored for:", user.email);
    loggedInUserEmail = user.email;
    
    if (menuLoginBtn) {
      menuLoginBtn.innerHTML = "👤 " + user.email;
      menuLoginBtn.style.color = "#4CAF50"; // Brand success green
    }

    // 2. THE HANDSHAKE: Link any guest purchases to this UID
    try {
      // Look for paid blocks that have this email but no ownerId yet
      const q = query(
        blocksCollection, 
        where("email", "==", user.email), 
        where("ownerId", "==", null),
        where("status", "==", "paid")
      );
      
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(async (blockDoc) => {
        await updateDoc(doc(db, "blocks", blockDoc.id), {
          ownerId: user.uid // Permanently link the purchase to this secure ID
        });
        console.log(`Legacy for Block #${blockDoc.id} secured to UID: ${user.uid}`);
      });
    } catch (err) {
      console.error("Handshake failed:", err);
    }

  } else {
    // 3. User is signed out or session expired
    loggedInUserEmail = null;
    if (menuLoginBtn) {
      menuLoginBtn.innerHTML = "🔑 Owner Login";
      menuLoginBtn.style.color = "";
    }
  }
});

// ================= CORE FUNCTIONS =================

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

      if (data.reserved === true && data.reservedAt && data.status !== "paid") {
        const now = Date.now();
        const reservedTime = data.reservedAt.toMillis();
        let timeLimit = 30 * 60 * 1000;
        if (data.isBulk === true) timeLimit = 1440 * 60 * 1000;

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

const handleSave = async () => {
  if (!valid()) return;
  
  const blockId = hiddenBlockNumber.value;
  const user = auth.currentUser; // Identifying the authenticated Keeper

  // 1. Check if the user is actually logged in before they try to save
  if (!user) {
    alert("Please login first so we know who owns this legacy!");
    return;
  }

  const originalText = saveBtn.textContent;
  saveBtn.disabled = true; 
  saveBtn.textContent = "Sealing...";

  try {
    const file = fileInput.files[0];
    const isImg = file.type.startsWith("image/");
    const isAud = file.type.startsWith("audio/");
    
    // 2. Upload the file to Storage
    const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
    await uploadBytes(fileRef, file);
    const mediaUrl = await getDownloadURL(fileRef);

    // 3. PUBLIC RECORD: Visible on the grid (Safe data only)
    await setDoc(doc(db, "blocks", blockId), {
      blockNumber: Number(blockId),
      message: messageInput.value,
      mediaUrl,
      mediaType: isAud ? "audio" : "image",
      ownerId: user.uid, // The permanent link to their account
      status: "pending"
    });

    // 4. PRIVATE RECORD: Stored in a sub-collection for your eyes only
    await setDoc(doc(db, "blocks", blockId, "private", "ownerData"), {
      email: user.email,
      name: nameInput.value,
      purchasedAt: serverTimestamp()
    });

    // 5. Trigger the PayPal button
    if (readyMsg) readyMsg.classList.remove("hidden");
    if (paymentButtons) {
        paymentButtons.classList.remove("hidden");
        const payLink = document.getElementById("externalPayBtn");
        if (payLink) {
            payLink.href = `https://www.paypal.com/ncp/payment/T9TZLXDZ6CLSE?block=${blockId}`;
        }
    }

  } catch (err) {
    console.error("Vault save failed:", err);
    alert("The Vault encountered an error. Please try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
};

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

  const chapterNameDisplay = document.getElementById("chapterName");
  const chapterRangeDisplay = document.getElementById("chapterRange");
  let districtTitle = "";
  if (pageNum <= 50) districtTitle = "THE PLAZA: Personal Legacies"; // Was Arena
  else if (pageNum <= 80) districtTitle = "THE BOULEVARD: Iconic Brands";
  else if (pageNum <= 110) districtTitle = "THE GARDEN: Memorials & Prayers"; // Renamed from Lobby
  else if (pageNum <= 160) districtTitle = "THE STAGE: Culture & Amapiano";
  else districtTitle = "THE ARENA: Sports & GOATs"; // Moved Arena to the end
  if (chapterNameDisplay) chapterNameDisplay.textContent = districtTitle;
  if (chapterRangeDisplay) chapterRangeDisplay.textContent = `Blocks ${start} – ${end}`;
  updateKeeper(pageNum);

  for (let i = start; i <= end; i++) {
    const div = document.createElement("div");
    div.className = "block";
    div.textContent = i;
    div.dataset.blockId = i;
    // --- WFC PARTNERSHIP VISUALS ---
const data = blockCache[i]; // This pulls the block's data from memory

if (data?.partnership === "WFC" && data?.status === "available") {
    div.classList.add("wfc-solidarity"); // This links to the CSS we'll add
    div.textContent = "💜"; // This replaces the number with a heart
}

    // --- VISUAL STYLING ---
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

    // --- CLICK HANDLER ---
    div.onclick = async () => {
      // 1. Reset UI
      const form = document.getElementById("blockForm");
      const lockedMsg = document.getElementById("lockedMsg");
      const warning = document.getElementById("reservedWarning");
      const selectedText = document.getElementById("selected-block-text");

      if (form) form.classList.remove("locked-form");
      if (lockedMsg) lockedMsg.classList.add("hidden");
      if (warning) warning.classList.add("hidden");
      
      // 2. Multi-Select Logic
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

      // 3. CASE: CLAIMED / PAID BLOCK
      if (claimed.includes(i)) {
        const data = await fetchBlock(i);
        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        div.classList.add("selected");
        hiddenBlockNumber.value = i;
        
        // Hide Reservation UI
        if (reserveBtn) reserveBtn.classList.add("hidden");
        const infoIconWrapper = document.querySelector(".reserve-wrapper");
        if (infoIconWrapper) infoIconWrapper.style.display = 'none';
        const justIcon = document.querySelector(".reserve-info-icon");
        if (justIcon) justIcon.style.display = 'none';

        const ownerEmail = data?.reservedBy || data?.email;
        const isOwner = loggedInUserEmail && ownerEmail && (loggedInUserEmail.toLowerCase() === ownerEmail.toLowerCase());

        // --- OWNER (EDIT MODE) ---
        if (isOwner) {
            if (selectedText) selectedText.textContent = `Managing Legacy: Block #${i}`;
            saveBtn.style.display = "block";
            saveBtn.textContent = "🚀 Update Legacy";
            saveBtn.disabled = false;
            saveBtn.onclick = () => handleKeeperUpdate(i);

            if (messageInput) {
                messageInput.classList.remove("hidden");
                messageInput.value = data.message || ""; 
                if (messageCounter) messageCounter.textContent = `${messageInput.value.length}/${MAX_MESSAGE_LENGTH}`;
            }
            if (fileInput) fileInput.classList.remove("hidden");
            if (lockedMsg) lockedMsg.classList.add("hidden");
            modal.classList.remove("hidden"); 
        
        // --- STRANGER (VIEW MODE) ---
        } else {
            const viewModal = document.getElementById("viewModal");
            const viewTitle = document.getElementById("viewBlockTitle");
            const viewMedia = document.getElementById("viewBlockMedia");
            const viewMessage = document.getElementById("viewBlockMessage");

            if (viewTitle) viewTitle.textContent = `Legacy Block #${i}`;

            const mediaUrl = data.mediaUrl || data.imageUrl;
            
            // Text Logic
            if (viewMessage) {
                if (data.message) {
                    viewMessage.textContent = `“${data.message}”`;
                    viewMessage.style.fontStyle = "italic";
                    viewMessage.style.color = "#fff"; 
                } else if (!mediaUrl) {
                    // Truly Empty
                    viewMessage.textContent = "This block has been reserved. No content uploaded yet."; 
                    viewMessage.style.fontStyle = "normal";
                    viewMessage.style.color = "#aaa"; 
                } else {
                    // Has Image but NO message
                     viewMessage.textContent = ""; 
                }
            }

            if (viewMedia) {
                viewMedia.innerHTML = ""; 
                const mediaType = data.mediaType || (data.imageUrl ? "image" : "audio");

                if (mediaUrl) {
                    if (mediaType === "image") {
                        const img = document.createElement("img");
                        img.src = mediaUrl;
                        img.style.maxWidth = "100%";
                        img.style.borderRadius = "8px";
                        viewMedia.appendChild(img);
                    } else if (mediaType === "audio") {
                        const audio = document.createElement("audio");
                        audio.controls = true;
                        audio.src = mediaUrl;
                        audio.style.width = "100%";
                        viewMedia.appendChild(audio);
                    }
                }
            }
            if (viewModal) viewModal.classList.remove("hidden"); 
        }
        return; 
      }

      // 4. CASE: RESERVED (UNPAID) BLOCK
      if (reservedBlocks.includes(i)) {
        const data = blockCache[i];
        const reservedBy = data?.reservedBy || null;
        const userEmail = loggedInUserEmail || emailInput?.value?.trim() || localStorage.getItem("userEmail");

        if (!userEmail || !reservedBy || userEmail.toLowerCase() !== reservedBy.toLowerCase()) {
          if (selectedText) selectedText.textContent = `Block #${i} (Reserved)`;
          if (lockedMsg) {
             lockedMsg.textContent = "This block is currently reserved."; 
             lockedMsg.classList.remove("hidden");
          }
          if (saveBtn) saveBtn.style.display = "none";
          modal.classList.remove("hidden"); 
          return;
        }
      }

      // 5. CASE: AVAILABLE BLOCK
      document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
      div.classList.add("selected");
      hiddenBlockNumber.value = i;
      if (selectedText) selectedText.textContent = `Selected Block: #${i}`;
     // --- WFC CLICK MESSAGE ---
// --- THE WFC CLICK LOGIC ---
if (data?.partnership === "WFC") {
    if (selectedText) selectedText.textContent = `Sponsor a Memorial: Block #${i}`;
    if (readyMsg) {
        readyMsg.innerHTML = "💜 <strong>Solidarity Block:</strong> $1 from this purchase goes directly to Women For Change.";
        readyMsg.classList.remove("hidden"); // Show the message
    }
} else {
    // THIS IS THE FIX: If it's NOT a WFC block, reset the text and hide the message
    if (selectedText) selectedText.textContent = `Selected Block: #${i}`;
    if (readyMsg) {
        readyMsg.innerHTML = ""; // Clear the WFC text
        readyMsg.classList.add("hidden"); // Hide the element entirely
    }
}
      const infoIconWrapper = document.querySelector(".reserve-wrapper");
      if (infoIconWrapper) infoIconWrapper.style.display = ''; 
      const justIcon = document.querySelector(".reserve-info-icon");
      if (justIcon) justIcon.style.display = '';

      if (nameInput) nameInput.classList.remove("hidden");
      if (emailInput) emailInput.classList.remove("hidden");
      if (fileInput) { fileInput.classList.remove("hidden"); fileInput.value = ""; }
      if (messageInput) { messageInput.classList.remove("hidden"); messageInput.value = ""; }
      if (reserveBtn) reserveBtn.classList.remove("hidden");
      if (saveBtn) { saveBtn.style.display = "block"; saveBtn.onclick = handleSave; }
      
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

async function handleKeeperUpdate(blockId) {
  const fileInput = document.getElementById("fileUpload");
  const messageInput = document.getElementById("message"); 
  const saveBtn = document.getElementById("uploadBtn");

  const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
  const hasMessage = messageInput && messageInput.value.trim().length > 0;

  if (!hasFile && !hasMessage) {
    alert("⚠️ Please enter a message or select a file to update.");
    return;
  }

  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "Updating...";

  try {
    const updateData = {
      status: "paid",
      updatedAt: serverTimestamp()
    };

    if (messageInput) {
      updateData.message = messageInput.value;
    }

    if (hasFile) {
      const file = fileInput.files[0];
      const isImg = file.type.startsWith("image/");
      const isAud = file.type.startsWith("audio/");

      if (!isImg && !isAud) {
        alert("❌ Only image or audio files can be uploaded.");
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        return;
      }

      const fileRef = ref(storage, `blocks/${blockId}/${file.name}`);
      await uploadBytes(fileRef, file);
      const mediaUrl = await getDownloadURL(fileRef);
      
      // Keep your data clean and consistent with handleSave
      updateData.mediaUrl = mediaUrl;
      updateData.mediaType = isAud ? "audio" : "image";
      updateData.imageUrl = isImg ? mediaUrl : null;
      updateData.audioUrl = isAud ? mediaUrl : null;
    }

    const blockRef = doc(db, "blocks", String(blockId));
    await updateDoc(blockRef, updateData);

    alert("✅ Legacy Updated!");
    location.reload();

  } catch (err) {
    console.error("Update failed:", err);
    alert("❌ Update failed: " + err.message);
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
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
    let title = "Arena Guide"; 
    let content = "Welcome to THE ARENA. High stakes, high glory.";

    // Logic for Page 1-50 (The Front Page)
    if (pageNum <= 50) { 
        title = "Plaza Mayor"; 
        content = "You are in THE PLAZA. This is where history starts—with ordinary people."; 
    }
    else if (pageNum <= 80) { 
        title = "Boulevard Scout"; 
        content = "Welcome to THE BOULEVARD. The intersection of art and identity."; 
    }
    else if (pageNum <= 110) { 
        title = "Garden Guardian"; 
        content = "You've entered THE GARDEN. A quiet place for those we remember."; 
    }
    else if (pageNum <= 160) { 
        title = "Stage Manager"; 
        content = "THE STAGE is vibrating. Leave your mark on the culture."; 
    }

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
    const blockRef = doc(blocksCollection, pendingBlockId);
    
    // 1. Mark as Paid immediately so it shows up on the grid
    await updateDoc(blockRef, { 
      status: "paid", 
      purchasedAt: serverTimestamp() 
    });

    const numId = Number(pendingBlockId);
    if (!claimed.includes(numId)) {
      claimed.push(numId); 
      localStorage.setItem("claimed", JSON.stringify(claimed));
    }

    // 2. Clear pending status but KEEP the ID for the "Claim" step
    localStorage.removeItem("pendingBlockId");
    
    // 3. Prompt them to create their permanent account
    alert("Payment received! 🎉 Your block is live. Now, 'Login' with the same email to permanently secure your editing rights.");
    
    // Clean URL
    window.history.replaceState({}, document.title, "/index.html");

  } catch (err) {
    console.error("Error finalizing PayPal:", err);
    alert("Payment detected, but the Vault is struggling to seal the block. Please contact support.");
  }
};

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Vault of Time: Initializing...");

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
// --- THE MAGIC LINK CATCHER ---
if (isSignInWithEmailLink(auth, window.location.href)) {
    // 1. Get the email from storage (saved when they clicked 'Send')
    let email = window.localStorage.getItem('emailForSignIn');
    
    // 2. If it's missing (e.g. they opened the link on a different device)
    if (!email) {
        email = window.prompt('Please provide your email for confirmation');
    }

    // 3. Complete the sign-in
    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            const user = result.user;
            console.log("Vault Keeper Authenticated:", user.uid);
            
            // UI Update: Show their email in the menu
            if (menuLoginBtn) {
                menuLoginBtn.innerHTML = "👤 " + (user.email || "Keeper");
                menuLoginBtn.style.color = "#4CAF50";
            }
            
            // Clean up the URL (remove the long security tokens)
            window.history.replaceState({}, document.title, "/index.html");
            
            alert("Welcome back, Keeper. Your session is secured.");
        })
        .catch((error) => {
            console.error("Magic link failed:", error);
            alert("This link has expired or was already used.");
        });
}
 if (menuLoginBtn) {
  menuLoginBtn.addEventListener("click", async () => {
    // --- LOGOUT LOGIC ---
    if (auth.currentUser) {
      const doLogout = confirm(`You are currently logged in as:\n${auth.currentUser.email}\n\nDo you want to log out?`);
      
      if (doLogout) {
        try {
          await signOut(auth); // Official Firebase sign out
          alert("✅ You have been logged out.");
          location.reload(); // Refresh to reset the grid view
        } catch (err) {
          console.error("Logout failed:", err);
        }
      }
      return; 
    }

    // --- LOGIN MODAL LOGIC (If not logged in) ---
    const sideMenu = document.getElementById("sideMenu");
    if (sideMenu) sideMenu.classList.remove("open");
    if (loginModal) loginModal.classList.remove("hidden");
    if (loginStep1) loginStep1.classList.remove("hidden");
    if (loginStep2) loginStep2.classList.add("hidden");
  });
}
  if (closeLogin) closeLogin.onclick = () => loginModal.classList.add("hidden");

 import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const auth = getAuth();

const actionCodeSettings = {
  url: 'https://vaultoftime.com/index.html', // Where they go after clicking the link
  handleCodeInApp: true,
};

// Replace your current loginSendBtn.onclick
loginSendBtn.onclick = async () => {
  const email = loginEmailInput.value.trim();
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
  alert("Check your inbox! We've sent you a magic login link.");
};

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

  const welcomeModal = document.getElementById("keeper-welcome-modal");
  if (welcomeModal && !localStorage.getItem("vaultKeeperMet")) welcomeModal.style.display = "flex";
  const welcomeCloseBtn = document.getElementById("close-keeper-welcome");
  if (welcomeCloseBtn) welcomeCloseBtn.onclick = () => { welcomeModal.style.display = "none"; localStorage.setItem("vaultKeeperMet", "true"); };

  const keeperBubble = document.getElementById("keeper-bubble");
  const triggerBtn = document.getElementById("keeper-trigger");
  if (triggerBtn && keeperBubble) triggerBtn.onclick = () => keeperBubble.style.display = keeperBubble.style.display === "none" ? "block" : "none";
  const keeperClose = document.getElementById("close-keeper-bubble");
  if (keeperClose) keeperClose.onclick = (e) => { e.stopPropagation(); keeperBubble.style.display = "none"; };

  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");
  if (menuToggle) menuToggle.addEventListener("click", () => { if (sideMenu) sideMenu.classList.add("open"); if (overlay) overlay.classList.add("show"); });
  const closeMenuFn = () => { if (sideMenu) sideMenu.classList.remove("open"); if (overlay) overlay.classList.remove("show"); };
  if (closeMenu) closeMenu.addEventListener("click", closeMenuFn);
  if (overlay) overlay.addEventListener("click", closeMenuFn);

  const headerTitle = document.querySelector(".vault-title");
  if (headerTitle) { headerTitle.style.cursor = "pointer"; headerTitle.addEventListener("click", () => window.location.href = "index.html"); }

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

  await handlePaypalReturn();
  await loadClaimedBlocks();
  renderPage(currentPage);
  hideLoader();
});
