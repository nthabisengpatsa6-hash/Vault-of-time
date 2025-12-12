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
// ADD THESE TWO NEW LINES:
let isMultiSelect = false;
let selectedBatch = [];
let lastClickedId = null;
let loggedInUserEmail = null;
let rangeStartId = null;
let currentPage = 1;
let claimed = [];          // paid blocks
let reservedBlocks = [];   // reserved but not paid
let blockCache = {};       // id → firestore data
// --- UI GLOBALS (Add these here so they are visible everywhere) ---
let bulkBar = null;
let bulkCount = null;
let markStartBtn = null;
let bulkReserveBtn = null;

let loginModal = null;
let menuLoginBtn = null;
let closeLogin = null;
let loginStep1 = null;
let loginStep2 = null;
let loginEmailInput = null;
let loginSendBtn = null;
let loginCodeInput = null;
let loginConfirmBtn = null;
let loginGeneratedCode = null;
let bulkCount = null;
let markStartBtn = null; 
let bulkReserveBtn = null; // Important for the final logic

// 2. Function to show/hide the floating bar
function updateBulkBar() {
    // Check if the element exists in the DOM first to avoid crashes
    if (!bulkBar || !bulkCount) return;

    if (selectedBatch.length > 0) {
        bulkBar.classList.remove("hidden");
        bulkBar.style.display = "flex"; 
        bulkCount.textContent = `${selectedBatch.length} Blocks Selected`;
    } else {
        // We generally rely on the toggle to hide it, but this updates the count
        bulkCount.textContent = "0 Blocks Selected";
    }
}
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

      // --- NEW: AUTO-RELEASE WITH 2-HOUR LOGIC ---
      // FIX: Only check timer if it is NOT paid yet
      if (data.reserved === true && data.reservedAt && data.status !== "paid") {
        const now = Date.now();
        const reservedTime = data.reservedAt.toMillis();
        
        // Default: 30 minutes
        let timeLimit = 30 * 60 * 1000; 

        // If it's a BULK order: 2 Hours (120 minutes)
        if (data.isBulk === true) {
            timeLimit = 120 * 60 * 1000; 
        }

        // Check if time is up
        if (now - reservedTime > timeLimit) {
          console.log("Auto-releasing expired reservation:", idNum);

          await setDoc(
            doc(blocksCollection, String(idNum)),
            {
              reserved: false,
              reservedBy: null,
              reservedAt: null,
              isBulk: null,
              reservedName: null,
              status: "available"
            },
            { merge: true }
          );

          // Update local data so the grid fixes itself immediately
          data.reserved = false;
          data.reservedBy = null;
          data.reservedAt = null;
        }
      }
      // --- END NEW LOGIC ---

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

    // Inputs (Keep these local with 'const')
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

    // --- ASSIGN GLOBALS (Do NOT use 'const' or 'let' here) ---
    // This connects the global names to the HTML elements
    bulkBar = document.getElementById("bulkActionBar");
    bulkCount = document.getElementById("bulkCount");
    markStartBtn = document.getElementById("markStartBtn");
    bulkReserveBtn = document.getElementById("bulkReserveBtn");

    loginModal = document.getElementById("loginModal");
    menuLoginBtn = document.getElementById("menuLoginBtn");
    closeLogin = document.querySelector(".close-login");
    
    loginStep1 = document.getElementById("loginStep1");
    loginStep2 = document.getElementById("loginStep2");
    loginEmailInput = document.getElementById("loginEmailInput");
    loginSendBtn = document.getElementById("loginSendBtn");
    loginCodeInput = document.getElementById("loginCodeInput");
    loginConfirmBtn = document.getElementById("loginConfirmBtn");
    
    // Check for critical missing elements
    if (!grid || !pagination || !modal) {
      console.error("Critical DOM elements missing.");
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
            div.style.color = "transparent"; // Hide the number
          } 
          else if (mediaUrl && mediaType === "audio") {
            div.classList.add("claimed-has-audio");
          } 
          else {
            // --- NEW: It is paid, but has no content yet ---
            div.classList.add("claimed-empty");
          }
        }

   // CLICK HANDLER
        div.onclick = async () => {
          
          // ============================================================
          // --- FIX START: RESET EVERYTHING ---
          // This runs on EVERY click to ensure no "sticky" locks
          // ============================================================
          const form = document.getElementById("blockForm");
          const lockedMsg = document.getElementById("lockedMsg");
          const warning = document.getElementById("reservedWarning");
          const uploadBtn = document.getElementById("uploadBtn");
          const selectedText = document.getElementById("selected-block-text");

          // 1. Unlock the form styles
          if (form) form.classList.remove("locked-form");
          
          // 2. Hide all warning messages
          if (lockedMsg) lockedMsg.classList.add("hidden");
          if (warning) warning.classList.add("hidden");

          // 3. Re-enable the button
          if (uploadBtn) {
              uploadBtn.disabled = false;
              uploadBtn.style.opacity = "1";
              uploadBtn.textContent = "Save Details"; 
          }
          // --- FIX END ---


          // --- MULTI-SELECT LOGIC ---
          if (isMultiSelect) {
             // 1. Check if valid (not paid)
             if (claimed.includes(i)) return alert("This block is already purchased.");
             
             // 2. Check if reserved by someone else
             if (reservedBlocks.includes(i)) {
                 const data = blockCache[i];
                 const savedEmail = localStorage.getItem("userEmail");
                 if (!data || data.reservedBy !== savedEmail) {
                     return alert("This block is reserved by another user.");
                 }
             }

             // 3. SHIFT CLICK LOGIC (Range Selection)
             if (window.event.shiftKey && lastClickedId !== null) {
                 const start = Math.min(lastClickedId, i);
                 const end = Math.max(lastClickedId, i);
                 
                 for (let k = start; k <= end; k++) {
                     if (claimed.includes(k)) continue;
                     if (reservedBlocks.includes(k)) {
                        const d = blockCache[k];
                        const myEmail = localStorage.getItem("userEmail");
                        if (!d || d.reservedBy !== myEmail) continue;
                     }

                     if (!selectedBatch.includes(k)) {
                         if (selectedBatch.length >= 500) {
                             alert("Max 500 blocks limit reached.");
                             break;
                         }
                         selectedBatch.push(k);
                         const el = document.querySelector(`.block[data-block-id='${k}']`);
                         if (el) el.classList.add("multi-selected");
                     }
                 }
             } 
             // 4. NORMAL CLICK LOGIC (Single Toggle)
             else {
                 const isSelected = selectedBatch.includes(i);

                 // --- NEW: RANGE END LOGIC ---
                 if (rangeStartId !== null) {
                     // If rangeStartId is set, this block is the intended END block.
                     // Clear any prior selections and select only the start and end points.
                     // The actual range selection will happen when they hit "Reserve All."
                     
                     // 1. Clear current selection
                     selectedBatch = []; 
                     document.querySelectorAll(".block").forEach(b => b.classList.remove("multi-selected"));

                     // 2. Add Start Block back
                     if (!selectedBatch.includes(rangeStartId)) {
                         selectedBatch.push(rangeStartId);
                         const startEl = document.querySelector(`.block[data-block-id='${rangeStartId}']`);
                         if (startEl) startEl.classList.add("multi-selected");
                     }

                     // 3. Add the clicked block (END)
                     if (!selectedBatch.includes(i)) {
                         selectedBatch.push(i);
                         div.classList.add("multi-selected");
                     }
                     
                     // Update the button text to show the range is ready
                     bulkReserveBtn.textContent = `Reserve Range (${Math.abs(rangeStartId - i) + 1} Blocks)`;
                     
                     // Reset lastClickedId so next shift-click works normally if range mode is cancelled
                     lastClickedId = i;
                     
                 } else {
                     // STANDARD TOGGLE MODE (No range start marked)
                     if (isSelected) {
                         // Deselect
                         selectedBatch = selectedBatch.filter(id => id !== i);
                         div.classList.remove("multi-selected");
                     } else {
                         // Select
                         if (selectedBatch.length >= 500) return alert("Max 500 blocks limit reached.");
                         selectedBatch.push(i);
                         div.classList.add("multi-selected");
                     }
                     // Remember this click for the next Shift-Click
                     lastClickedId = i;
                 }
             }

             updateBulkBar();
             return; 
          }
          // --- END MULTI-SELECT ---


          // Restore saved email if empty
          const storedEmail = localStorage.getItem("userEmail");
          if (storedEmail && emailInput && !emailInput.value.trim()) {
            emailInput.value = storedEmail;
          }

          // RESERVED BLOCK HANDLING
          if (reservedBlocks.includes(i)) {
            const data = blockCache[i];
            const reservedBy = data?.reservedBy || null;

            // Gather all possible ways the user might be identified
            const savedEmail = localStorage.getItem("userEmail");
            const typedEmail = emailInput?.value?.trim() || null;
            
            // --- FIX: PRIORITIZE LOGGED IN USER ---
            // If loggedInUserEmail exists, we use that first.
            const userEmail = loggedInUserEmail || typedEmail || savedEmail; 

            // If NOT the owner — lock the whole form UI
            if (!userEmail || !reservedBy || userEmail.toLowerCase() !== reservedBy.toLowerCase()) {
              modal.classList.remove("hidden");

              if (warning) warning.classList.remove("hidden");
              if (form) form.classList.add("locked-form");
              if (lockedMsg) lockedMsg.classList.remove("hidden");

              if (selectedText) {
                selectedText.textContent = `Block #${i} (Reserved by another user)`;
              }

              if (uploadBtn) {
                  uploadBtn.disabled = true;
                  uploadBtn.style.opacity = "0.3";
              }

              return; // STOP — user cannot continue
            }

            // If we reach this point, the user is the owner! 
            // We do nothing else here, allowing the code to continue to the upload form.
          }
            

            // If the user IS the reserver, the form is already unlocked by the fix at the top!
        

          // VIEW CLAIMED BLOCK
          if (claimed.includes(i)) {
            const data = await fetchBlock(i);

            // Check if logged-in owner
            const ownerEmail = data?.reservedBy || data?.email; 
            if (loggedInUserEmail && ownerEmail && loggedInUserEmail.toLowerCase() === ownerEmail.toLowerCase()) {
                // IT MATCHES! Open the Edit Form
                document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
                div.classList.add("selected");

                hiddenBlockNumber.value = i;
                if (selectedText) selectedText.textContent = `Editing Block: #${i}`;
                
                nameInput.value = data.name || "";
                emailInput.value = data.email || ""; 
                messageInput.value = data.message || "";
                
                if (uploadBtn) {
                    uploadBtn.disabled = false;
                    uploadBtn.style.opacity = "1";
                    uploadBtn.textContent = "Update Content"; 
                }

                modal.classList.remove("hidden");
                return; 
            }

            // Standard View for non-owners
            const titleEl = document.getElementById("viewBlockTitle");
            const msgEl = document.getElementById("viewBlockMessage");
            const mediaEl = document.getElementById("viewBlockMedia");
            const ownerEditBtn = document.getElementById("ownerEditBtn");

            if (titleEl) titleEl.textContent = `Block #${i}`;
            if (msgEl) msgEl.textContent = data?.message || "";

            if (ownerEditBtn) {
                 if (loggedInUserEmail) {
                     ownerEditBtn.classList.add("hidden"); 
                 } else {
                     ownerEditBtn.classList.remove("hidden");
                 }
            }

            if (mediaEl) {
              const mediaUrl = data?.mediaUrl || data?.imageUrl;
              const mediaType = data?.mediaType;

              if (mediaUrl && mediaType === "image") {
                mediaEl.innerHTML = `<img src="${mediaUrl}" style="max-width:100%;border-radius:8px;" />`;
              } else if (mediaUrl && mediaType === "audio") {
                mediaEl.innerHTML = `<audio controls style="width:100%;margin-top:10px;"><source src="${mediaUrl}" /></audio>`;
              } else {
                mediaEl.innerHTML = "<p style='opacity:0.6; font-style:italic;'>This block has been secured, but the owner has not uploaded content yet.</p>";
              }
            }

            viewModal.classList.remove("hidden");
            return;
          }

          // UNCLAIMED / AVAILABLE → Select for upload
          document.querySelectorAll(".block").forEach((b) =>
            b.classList.remove("selected")
          );
          div.classList.add("selected");

          hiddenBlockNumber.value = i;

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

// --------- NEW: BULK UI HELPERS ----------

// CORRECTED ASSIGNMENT: (Ensure these are assigned without let/const if declared globally)
const multiSelectToggle = document.getElementById("multiSelectMode");
bulkBar = document.getElementById("bulkActionBar");
bulkCount = document.getElementById("bulkCount");
markStartBtn = document.getElementById("markStartBtn"); 
bulkReserveBtn = document.getElementById("bulkReserveBtn"); 
    
// 1. Listen for the toggle switch
    if (multiSelectToggle) {
        multiSelectToggle.addEventListener("change", (e) => {
            isMultiSelect = e.target.checked;
            selectedBatch = []; // Clear selection when switching
            
            // Remove visual selection from all blocks
            document.querySelectorAll(".block").forEach(b => b.classList.remove("multi-selected"));
            
            // Force bar visibility logic
            if (isMultiSelect) {
                if(bulkBar) {
                    bulkBar.style.display = "flex";
                    bulkBar.classList.remove("hidden");
                }
                // Reset button labels
                if (markStartBtn && bulkReserveBtn) {
                    markStartBtn.textContent = '1. Mark Start';
                    markStartBtn.style.borderColor = '#D4AF37';
                    markStartBtn.style.color = '#D4AF37';
                    bulkReserveBtn.textContent = 'Reserve All';
                }
            } else {
                if(bulkBar) {
                    bulkBar.classList.add("hidden");
                    bulkBar.style.display = "none";
                }
            }
            updateBulkBar(); 
        });
    }
    
    // --------- INIT ----------
    await handlePaypalReturn();
    await loadClaimedBlocks();
    renderPage(currentPage);

  } catch (err) { // This closes the 'try' block
    console.error("FATAL Vault init error:", err);
    alert("An error occurred. Please refresh.");
  } 

  // ====================================================================
  // EVENT LISTENERS (Outside try/catch, inside DOMContentLoaded)
  // ====================================================================

  // --- 1. MARK START BUTTON ---
  if (markStartBtn) { 
      markStartBtn.addEventListener("click", () => {
          if (selectedBatch.length === 0) {
              alert("Please select the starting block first by tapping it.");
              return;
          }
          rangeStartId = selectedBatch[0];
          
          markStartBtn.textContent = `2. Select Range (Start: #${rangeStartId})`;
          markStartBtn.style.borderColor = '#4CAF50'; 
          markStartBtn.style.color = '#4CAF50';
          bulkReserveBtn.textContent = '3. Confirm Reservation'; 

          alert(`Starting block marked: #${rangeStartId}. Now tap the final block.`);
      });
  }

  // --- 2. BULK RESERVE BUTTON ---
  if (bulkReserveBtn) { 
      bulkReserveBtn.addEventListener("click", async () => {
          // Range Mode Logic
          if (rangeStartId !== null) {
              const rangeEndId = selectedBatch.length > 0 ? selectedBatch[selectedBatch.length - 1] : rangeStartId;

              if (rangeStartId === rangeEndId) {
                  alert("Please tap the final block in your range.");
                  return;
              }

              const start = Math.min(rangeStartId, rangeEndId);
              const end = Math.max(rangeStartId, rangeEndId);

              // Execute Selection
              bulkReserveBtn.textContent = "Selecting...";
              bulkReserveBtn.disabled = true;

              for (let k = start; k <= end; k++) {
                  if (claimed.includes(k)) continue;
                  // (Check reservedBlocks logic omitted for brevity, handled by grid check usually)
                  // Simple add to selection:
                  if (!selectedBatch.includes(k)) {
                      selectedBatch.push(k);
                      const el = document.querySelector(`.block[data-block-id='${k}']`);
                      if (el) el.classList.add("multi-selected");
                  }
              }

              updateBulkBar();
              rangeStartId = null; 

              // Reset UI
              markStartBtn.textContent = '1. Mark Start';
              markStartBtn.style.borderColor = '#D4AF37';
              markStartBtn.style.color = '#D4AF37';
              bulkReserveBtn.textContent = 'Reserve All';
              bulkReserveBtn.disabled = false;
              
              return executeBulkReservation(); 
          }

          // Standard Mode
          return executeBulkReservation();
      });
  }

  // --- 3. OWNER LOGIN SYSTEM ---
  if(menuLoginBtn) {
      menuLoginBtn.addEventListener("click", () => {
          if(loggedInUserEmail) {
              alert("You are currently logged in as: " + loggedInUserEmail);
              return;
          }
          // Close side menu if open
          const sideMenu = document.getElementById("sideMenu"); 
          if(sideMenu) sideMenu.classList.remove("open");
          
          if(loginModal) loginModal.classList.remove("hidden");
          if(loginStep1) loginStep1.classList.remove("hidden");
          if(loginStep2) loginStep2.classList.add("hidden");
      });
  }

  if(closeLogin) {
      closeLogin.onclick = () => loginModal.classList.add("hidden");
  }

  // Login Send Code
  if(loginSendBtn) {
      loginSendBtn.onclick = async () => {
          const email = loginEmailInput.value.trim();
          if(!email) return alert("Enter your email.");
          loginSendBtn.textContent = "Sending...";
          loginSendBtn.disabled = true;

          try {
              loginGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
              const serviceID = "service_pmuwoaa"; 
              const templateID = "template_ifxwqp6"; 
              await emailjs.send(serviceID, templateID, { email: email, code: loginGeneratedCode });
              
              alert("Code sent! Check your inbox.");
              loginStep1.classList.add("hidden");
              loginStep2.classList.remove("hidden");
          } catch (err) {
              console.error(err);
              alert("Error sending code.");
              loginSendBtn.textContent = "Send Login Code";
              loginSendBtn.disabled = false;
          }
      };
  }

  // Login Verify Code
  if(loginConfirmBtn) {
      loginConfirmBtn.onclick = () => {
          const code = loginCodeInput.value.trim();
          if(code === loginGeneratedCode) {
              loggedInUserEmail = loginEmailInput.value.trim().toLowerCase();
              alert("✅ Login Successful!");
              loginModal.classList.add("hidden");
              menuLoginBtn.innerHTML = "👤 " + loggedInUserEmail;
              menuLoginBtn.style.color = "#4CAF50"; 
          } else {
              alert("❌ Incorrect code.");
          }
      };
  }

  hideLoader();

}); // <--- FINAL CLOSING BRACKET for DOMContentLoaded

// ================================================================
// THE BULK RESERVATION FUNCTION (MUST BE AT THE VERY BOTTOM)
// ================================================================

async function executeBulkReservation() {
    // 1. Safety Check
    if (!selectedBatch || selectedBatch.length === 0) return;

    // 2. Get User Details
    const name = prompt("Please enter your Name for the quote:");
    if (!name) return; // User cancelled
    
    const email = prompt("Please enter your Email address for the quote:");
    if (!email) return; // User cancelled

    // 3. Change Button Text
    const bulkBtn = document.getElementById("bulkReserveBtn");
    const originalText = bulkBtn ? bulkBtn.textContent : "Reserve All";
    if (bulkBtn) {
        bulkBtn.textContent = "Processing...";
        bulkBtn.disabled = true;
    }

    // 4. Calculate Costs
    const pricePerBlock = 6;
    const totalCost = selectedBatch.length * pricePerBlock;
    const blockListString = selectedBatch.join(", ");

    try {
        // 5. Update Firestore
        const promises = selectedBatch.map(blockId => {
            return setDoc(
                doc(blocksCollection, String(blockId)), 
                {
                    reserved: true,
                    reservedBy: email,
                    reservedName: name, 
                    reservedAt: serverTimestamp(),
                    isBulk: true,
                    status: "pending_quote"
                }, 
                { merge: true }
            );
        });

        await Promise.all(promises);

        // 6. SEND EMAIL NOTIFICATION
        const serviceID = "service_pmuwoaa";   
        const templateID = "template_xraan78"; 

        const emailParams = {
            name: name,
            email: email,
            block_count: selectedBatch.length,
            total_cost: totalCost,
            block_list: blockListString
        };

        await emailjs.send(serviceID, templateID, emailParams);
        console.log("Email notification sent!");

        // 7. Success Message
        alert(
            `SUCCESS! \n\nBlocks have been reserved.` +
            `\nTotal Estimated Cost: $${totalCost}` +
            `\n\nWe have received your request. Check your inbox shortly for the official payment link.`
        );

        location.reload(); 

    } catch (err) {
        console.error("Bulk reserve error:", err);
        alert("Something went wrong. Please try again.");
        if (bulkBtn) {
            bulkBtn.textContent = originalText;
            bulkBtn.disabled = false;
        }
    }
}
