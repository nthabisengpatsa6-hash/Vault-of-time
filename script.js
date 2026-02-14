// ================= 1. FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, 
  addDoc, serverTimestamp, query, orderBy, limit, where 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ================= 2. CONFIGURATION =================
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
const storage = getStorage(app);

// Global Variables
const TOTAL_BLOCKS = 50; 
let blockCache = {};        // Stores the content (images/audio)
let claimedBlocks = [];     // Stores which blocks are sold
let loggedInUserEmail = null; // Stores who is currently logged in
let countdownInterval = null; // Stores the active timer ID

// ================= 3. THE HANDSHAKE LOADER =================
function performHandshake() {
  const loader = document.getElementById("vault-loader");
  if (!loader) return;

  // Inject HTML if missing
  if (!loader.querySelector(".vault-spinner-box")) {
      loader.innerHTML = `
        <div class="vault-spinner-box">
            <div class="vault-ring"></div>
            <div class="vault-core"></div>
        </div>
        <div class="vault-loader-text">INITIALIZING PROTOCOL...</div>
      `;
  }

  const loaderText = loader.querySelector(".vault-loader-text");
  const messages = [
    "Verifying Curation Standards...",
    "Syncing with the Ledger...",
    "Authenticating Coordinates...",
    "Access Granted."
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (loaderText) {
      loaderText.style.opacity = 0.2;
      setTimeout(() => {
        loaderText.textContent = messages[i];
        loaderText.style.opacity = 1;
        i++;
      }, 150);
    }
    
    if (i >= messages.length) {
      clearInterval(interval);
      setTimeout(hideLoader, 600); 
    }
  }, 1200); 
}

function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");
  
  if (loader) {
    loader.style.opacity = 0;
    setTimeout(() => loader.remove(), 800);
  }
  if (main) main.classList.add("vault-main-visible");
}

// ================= 4. SESSION MANAGEMENT =================
function checkSession() {
    const session = localStorage.getItem('vault_session');
    const loginModal = document.getElementById("loginModal"); 
    const loginBtn = document.getElementById("menuLoginBtn");

    if (session) {
        try {
            const { email, expiresAt } = JSON.parse(session);
            
            // Check if session is expired (6 hours)
            if (Date.now() < expiresAt) {
                loggedInUserEmail = email;
                
                // Hide login modal if open
                if (loginModal) loginModal.classList.add("hidden");
                
                // Update Menu Button
                if (loginBtn) {
                    const shortName = email.split('@')[0];
                    loginBtn.innerHTML = `👤 ${shortName.toUpperCase()} <span style="font-size: 0.7em; opacity: 0.6; margin-left: 10px;">(DISCONNECT)</span>`;
                    loginBtn.style.color = "#D4AF37";
                }
                console.log("Session Validated:", email);
            } else {
                // Expired
                localStorage.removeItem('vault_session');
                loggedInUserEmail = null;
            }
        } catch (e) {
            console.error("Session Corrupt");
            localStorage.removeItem('vault_session');
            loggedInUserEmail = null;
        }
    }
}

// ================= 5. AUCTION ENGINE (PRICING) =================
async function getCurrentFloorPrice() {
  try {
    // 1. Get the most recently sold block from the Ledger
    const q = query(collection(db, "ledger"), orderBy("blockId", "desc"), limit(1));
    const snap = await getDocs(q);
    
    // 2. If nothing sold yet, start at $1000
    if (snap.empty) return 1000; 
    
    // 3. Otherwise, take last price and add 10%
    const lastPrice = snap.docs[0].data().price;
    return Math.ceil(lastPrice * 1.1); 
  } catch (err) {
    console.error("Price error:", err);
    return 1000;
  }
}

// ================= 6. DATA LOADING =================
async function loadVault() {
  try {
      console.log("Loading Vault Data...");
      
      // Fetch Content (Blocks) and History (Ledger) in parallel
      const [blocksSnap, ledgerSnap] = await Promise.all([
          getDocs(collection(db, "blocks")),
          getDocs(collection(db, "ledger"))
      ]);

      claimedBlocks = [];
      blockCache = {};
      
      // Map the Ledger to find out what is SOLD
      ledgerSnap.forEach(d => {
        claimedBlocks.push(Number(d.data().blockId));
      });

      // Map the Blocks to get the CONTENT (Images/Audio)
      blocksSnap.forEach(d => {
        blockCache[d.id] = d.data();
      });

      // Now draw the grid
      renderGrid();
  } catch (err) {
      console.error("Error loading vault:", err);
  }
}

// ================= 7. RENDER GRID (WITH LIVE TIMER) =================
async function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  grid.innerHTML = ""; 
  const floorPrice = await getCurrentFloorPrice();
  let activeBlockFound = false;

  // Clear old timer if re-rendering
  if (countdownInterval) clearInterval(countdownInterval);

  for (let i = 1; i <= TOTAL_BLOCKS; i++) {
    const div = document.createElement("div");
    div.className = "block";
    
    // Check if Sold (Public or Private)
    const isSold = claimedBlocks.includes(i) || (blockCache[i] && blockCache[i].status === "paid");

    if (isSold) {
      // --- STATE: SOLD ---
      div.classList.add("claimed");
      div.innerHTML = `<span class="coord-num">#${i}</span>`;
      const data = blockCache[i];
      if (data && data.mediaUrl && data.mediaType === "image") {
        div.style.backgroundImage = `url(${data.mediaUrl})`;
        div.style.backgroundSize = "cover";
        div.querySelector(".coord-num").style.display = "none";
      }
      div.onclick = () => handleCoordinateClick(i, "sold");
    } 
    else if (!activeBlockFound) {
      // --- STATE: ACTIVE (GOLDEN PULSE) ---
      div.classList.add("active-bid");
      
      const blockData = blockCache[i];
      let priceOrTimerHTML = `<span class="price-tag">BID OPEN: $${floorPrice}</span>`;
      
      // CHECK: Did the admin set a timer for this block?
      if (blockData && blockData.auctionEndsAt) {
          // We give this span a specific ID so the interval can find it
          priceOrTimerHTML = `<span id="live-timer-${i}" class="price-tag" style="font-family:monospace; font-size: 0.9em; color:#D4AF37;">Loading Timer...</span>`;
          
          // Start the live clock immediately
          // We use setTimeout to let the div attach to the DOM first
          setTimeout(() => startLiveCountdown(blockData.auctionEndsAt, `live-timer-${i}`), 100);
      }

      div.innerHTML = `
        <span class="coord-num" style="color:#D4AF37;">#${i}</span>
        ${priceOrTimerHTML}
      `;
      
      div.onclick = () => handleCoordinateClick(i, "active", floorPrice);
      activeBlockFound = true; 
    } 
    else {
      // --- STATE: LOCKED ---
      div.classList.add("locked");
      div.innerHTML = `<span class="coord-num">#${i}</span><span class="lock-icon">🔒</span>`;
      div.onclick = () => alert("This coordinate is currently locked.");
    }
    
    grid.appendChild(div);
  }
}


// ================= 8. CLICK HANDLER (THE ROUTER) =================
async function handleCoordinateClick(id, state, price) {
  const viewModal = document.getElementById("viewModal");
  const inquiryModal = document.getElementById("modal");
  const ownerModal = document.getElementById("ownerModal");
  
  // --- OWNER CHECK ---
  // Is there a user logged in? AND Does their email match the ownerEmail of this block?
  const isActualOwner = loggedInUserEmail && blockCache[id] && blockCache[id].ownerEmail === loggedInUserEmail;

  if (isActualOwner) {
    // Open the Secret Owner Dashboard
    if (ownerModal) {
        document.getElementById("ownerBlockTitle").textContent = `Coordinate #${id}: Owner Suite`;
        document.getElementById("ownerMessage").value = blockCache[id].message || "";
        ownerModal.classList.remove("hidden");
    } else {
        alert("Owner Modal Missing in HTML!");
    }
    return; // Stop here, don't show public view
  }

  // --- PUBLIC VIEWS ---
  if (state === "sold") {
    // Show Museum View
    const data = blockCache[id];
    document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
    document.getElementById("viewBlockMessage").textContent = data ? data.message : "Archives sealed.";
    const mediaContainer = document.getElementById("viewBlockMedia");
    
    if (data && data.mediaType === "image") {
        mediaContainer.innerHTML = `<img src="${data.mediaUrl}" style="width:100%; border-radius: 4px;">`;
    } else {
        mediaContainer.innerHTML = "<p style='text-align:center; color:#888;'>[Audio/Text Artifact]</p>";
    }
    viewModal.classList.remove("hidden");
  } 
  else if (state === "active") {
    // Show Bid Application
    document.getElementById("blockNumber").value = id;
    document.getElementById("selected-block-text").textContent = `Coordinate #${id}: Apply to Bid`;
    inquiryModal.classList.remove("hidden");
  }
}

// ================= 9. OWNER UPLOAD LOGIC =================
async function handleOwnerUpload() {
  const fileInput = document.getElementById("mediaUpload");
  const file = fileInput ? fileInput.files[0] : null;
  const message = document.getElementById("ownerMessage").value;
  // Extract Block ID from the Modal Title (e.g. "Coordinate #1...")
  const titleText = document.getElementById("ownerBlockTitle").textContent;
  const blockId = titleText.match(/\d+/)[0]; 
  const btn = document.getElementById("finalizeEtchingBtn");

  if (!file) return alert("Please select an artifact (image/audio) to etch.");

  btn.disabled = true;
  btn.textContent = "UPLOADING ARTIFACT...";
  document.getElementById("uploadProgress").style.display = "block";

  try {
    // 1. Upload File to Firebase Storage
    const storageRef = ref(storage, `blocks/${blockId}/${file.name}`);
    const uploadTask = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(uploadTask.ref);

    // 2. Update Firestore Database
    await updateDoc(doc(db, "blocks", blockId), {
      mediaUrl: downloadURL,
      mediaType: file.type.startsWith('image') ? 'image' : 'audio',
      message: message,
      status: "paid" // Ensure it remains marked as paid
    });

    alert("ETCHING COMPLETE. Your legacy is sealed.");
    location.reload(); // Refresh page to see changes
  } catch (err) {
    console.error(err);
    alert("Upload restricted. Check file size limits or connection.");
  } finally {
    btn.disabled = false;
    btn.textContent = "COMMENCE ETCHING";
  }
}

// ================= 10. BID APPLICATION LOGIC =================
async function handleInquiry() {
  const btn = document.getElementById("uploadBtn");
  const blockId = document.getElementById("blockNumber").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const name = document.getElementById("name").value.trim();
  const message = document.getElementById("message").value;
  
  // Grab Bid Amount (Handle case where element might be missing)
  const bidInput = document.getElementById("bidAmount");
  const bidAmount = bidInput ? bidInput.value : "0";

  if (!email || !name || !bidAmount) return alert("Credentials and Bid Amount required.");
  
  btn.disabled = true;
  btn.textContent = "Etching Application...";

  try {
    // 1. Save to Firestore
    await addDoc(collection(db, "inquiries"), {
      coordinate: blockId,
      bidderEmail: email,
      bidderName: name,
      bidAmount: bidAmount,
      message: message,
      timestamp: serverTimestamp(),
      status: "reviewing"
    });

    // 2. Send Email via EmailJS
    if (window.emailjs) {
      // MAKE SURE 'template_a0yyy47' MATCHES YOUR EMAILJS DASHBOARD
      await emailjs.send("service_pmuwoaa", "template_a0yyy47", {
        name: name, 
        email: email, 
        coordinate: blockId, 
        bidAmount: bidAmount,
        message: message,
        note: "High-Value Bid Application"
      });
    }

    alert("Application Logged. The Curator will review your credentials.");
    document.getElementById("modal").classList.add("hidden");
    
    // Clear inputs
    document.getElementById("email").value = "";
    document.getElementById("name").value = "";
    if(bidInput) bidInput.value = "";
    document.getElementById("message").value = "";

  } catch (err) {
    console.error(err);
    alert("Vault restricted. Try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Application to Bid";
  }
}

// ================= 11. LOGIN VERIFICATION =================
async function verifyAccessKey() {
    const email = document.getElementById("loginEmailInput").value.trim().toLowerCase();
    const enteredKey = document.getElementById("loginKeyInput").value.trim();
    const loginBtn = document.getElementById("loginSendBtn");

    if (!email || !enteredKey) return alert("Credentials required.");

    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying...";

    try {
        // Check Firestore for the authorized bidder
        const snap = await getDoc(doc(db, "authorized_bidders", email));
        
        if (snap.exists() && snap.data().accessKey === enteredKey) {
            // Success: Create Session
            localStorage.setItem('vault_session', JSON.stringify({ 
                email: email, 
                expiresAt: Date.now() + 21600000 // 6 Hours
            }));
            
            alert(`✅ Access Granted. Welcome, ${snap.data().bidderName || "Keeper"}.`);
            
            // Refresh logic without reloading page
            checkSession(); 
            document.getElementById("loginModal").classList.add("hidden");
            location.reload(); // Reload to update grid with owner permissions
        } else {
            alert("❌ Invalid Credentials.");
        }
    } catch (err) {
        console.error(err);
        alert("Verification restricted.");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Verify Identity";
    }
}

// ================= 12. UI INITIALIZATION =================
function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    headers.forEach(header => {
        // Clone to remove old listeners
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.onclick = function() {
            // Special Case: Login Button
            if (this.id === "menuLoginBtn") {
                if (loggedInUserEmail) {
                    if(confirm("Sever connection to the Vault?")) {
                        localStorage.removeItem('vault_session');
                        location.reload();
                    }
                    return;
                }
                document.getElementById("loginModal").classList.remove("hidden");
                return;
            }

            // Normal Accordion Behavior
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            if (content && content.classList.contains("accordion-content")) {
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    content.style.opacity = 0;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    content.style.opacity = 1;
                }
            }
        };
    });
}

// ================= LIVE COUNTDOWN LOGIC =================
function startLiveCountdown(deadline, elementId) {
    // Clear any existing timer to prevent conflicts
    if (countdownInterval) clearInterval(countdownInterval);

    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;

    const endTime = deadline.toDate().getTime(); // Convert Firestore timestamp to JS milliseconds

    // Update the count down every 1 second
    countdownInterval = setInterval(function() {
        const now = new Date().getTime();
        const distance = endTime - now;

        // TIME CALCULATION
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // DISPLAY
        if (distance < 0) {
            clearInterval(countdownInterval);
            timerElement.innerHTML = "⛔ CLOSED";
            timerElement.style.color = "red";
            timerElement.parentElement.classList.add("expired"); // Optional styling
        } else {
            // "23h 59m 59s" format
            timerElement.innerHTML = `⏳ ${hours}h ${minutes}m ${seconds}s`;
            
            // Panic Mode: If less than 1 hour, make it red
            if (hours < 1) {
                timerElement.style.color = "#ff4d4d";
                timerElement.style.animation = "pulseRed 1s infinite"; 
            }
        }
    }, 1000); // 1000ms = 1 second
}

// ================= 13. BOOTSTRAP (RUN ON LOAD) =================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Auth & Session
  checkSession();
  onAuthStateChanged(auth, (user) => { if (!user) signInAnonymously(auth); });

  // 2. Load Data
  loadVault();
  performHandshake();
  initAccordion();

  // 3. Event Listeners (Safely Bind)
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  
  // Close Buttons
  document.querySelectorAll(".close-button").forEach(b => b.onclick = () => document.getElementById("modal").classList.add("hidden"));
  document.querySelectorAll(".close-view").forEach(b => b.onclick = () => document.getElementById("viewModal").classList.add("hidden"));
  document.querySelectorAll(".close-login").forEach(b => b.onclick = () => document.getElementById("loginModal").classList.add("hidden"));
  document.querySelectorAll(".close-owner").forEach(b => b.onclick = () => document.getElementById("ownerModal").classList.add("hidden"));

  // Action Buttons
  bind("uploadBtn", handleInquiry);
  bind("finalizeEtchingBtn", handleOwnerUpload);
  bind("loginSendBtn", verifyAccessKey);
  
  // Menu
  bind("menuToggle", () => document.getElementById("sideMenu").classList.add("open"));
  bind("closeMenu", () => document.getElementById("sideMenu").classList.remove("open"));
});
