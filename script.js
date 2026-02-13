
// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, 
  addDoc, serverTimestamp, query, orderBy, limit, where 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ================= CONFIG & SCARCITY =================
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

const TOTAL_BLOCKS = 50; 
let blockCache = {};
let claimed = [];
let loggedInUserEmail = null;

// ================= THE FANCY "SECURITY HANDSHAKE" LOADER =================
function performHandshake() {
  const loader = document.getElementById("vault-loader");
  if (!loader) return;

  // 1. Inject the fancy HTML structure dynamically
  // This ensures the loader looks right even if HTML is old
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
  
  // 2. Cycle through messages with a glitch effect
  const interval = setInterval(() => {
    if (loaderText) {
      loaderText.style.opacity = 0.2; // Dim text briefly
      setTimeout(() => {
        loaderText.textContent = messages[i];
        loaderText.style.opacity = 1; // Bring it back
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

// ================= SESSION & AUTH =================
function checkSession() {
    const session = localStorage.getItem('vault_session');
    const loginModal = document.getElementById("loginModal"); 
    const loginBtn = document.getElementById("menuLoginBtn");

    if (session) {
        try {
            const { email, expiresAt } = JSON.parse(session);
            
            // Check if session is still valid
            if (Date.now() < expiresAt) {
                loggedInUserEmail = email;
                
                // Hide the login box if it's currently open
                if (loginModal) loginModal.classList.add("hidden");

                // Update the menu button VISUALS
                if (loginBtn) {
                    // Show email and a disconnect hint
                    const shortName = email.split('@')[0];
                    loginBtn.innerHTML = `👤 ${shortName.toUpperCase()} <span style="font-size: 0.7em; opacity: 0.6; margin-left: 10px;">(DISCONNECT)</span>`;
                    loginBtn.style.color = "#D4AF37";
                }
                console.log("Session restored for:", email);
            } else {
                // Session expired
                console.log("Session expired.");
                localStorage.removeItem('vault_session');
                loggedInUserEmail = null;
            }
        } catch (e) {
            console.error("Session parse error", e);
            localStorage.removeItem('vault_session');
            loggedInUserEmail = null;
        }
    } else {
        loggedInUserEmail = null;
    }
}
// ================= THE AUCTION RATCHET =================
async function getCurrentFloorPrice() {
  try {
    const q = query(collection(db, "blocks"), where("status", "==", "paid"), orderBy("purchasePrice", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return 1000; 
    const lastPrice = snap.docs[0].data().purchasePrice;
    return Math.ceil(lastPrice * 1.1); 
  } catch (err) {
    console.error("Price fetch error:", err);
    return 1000; // Default fallback
  }
}

// ================= CORE DATA FETCH =================
async function loadVault() {
  try {
      const snap = await getDocs(collection(db, "blocks"));
      claimed = [];
      blockCache = {};
      
      snap.forEach(d => {
        const data = d.data();
        blockCache[d.id] = data;
        if (data.status === "paid") claimed.push(Number(d.id));
      });
      renderGrid();
  } catch (err) {
      console.error("Error loading vault:", err);
  }
}

// ================= GALLERY RENDERING =================
async function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  grid.innerHTML = ""; // Clear current grid
  const floorPrice = await getCurrentFloorPrice();

  for (let i = 1; i <= TOTAL_BLOCKS; i++) {
    const div = document.createElement("div");
    div.className = "block";
    div.innerHTML = `<span class="coord-num">#${i}</span>`;
    
    if (claimed.includes(i)) {
      div.classList.add("claimed");
      const data = blockCache[i];
      if (data && data.mediaUrl && data.mediaType === "image") {
        div.style.backgroundImage = `url(${data.mediaUrl})`;
        div.style.backgroundSize = "cover";
        div.querySelector(".coord-num").style.display = "none";
      }
    } else {
      div.innerHTML += `<span class="price-tag">Entry: $${floorPrice}</span>`;
    }
    div.onclick = () => handleCoordinateClick(i, floorPrice);
    grid.appendChild(div);
  }
}

// ================= THE INQUIRY ENGINE =================
async function handleCoordinateClick(id, price) {
  const data = blockCache[id];
  const viewModal = document.getElementById("viewModal");
  const inquiryModal = document.getElementById("modal");
  
  if (data && data.status === "paid") {
    // Show Museum View
    document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
    document.getElementById("viewBlockMessage").textContent = data.message || "A silent legacy.";
    const mediaContainer = document.getElementById("viewBlockMedia");
    
    // Safety check for media
    if (data.mediaType === "image") {
        mediaContainer.innerHTML = `<img src="${data.mediaUrl}" style="width:100%; border-radius: 4px;">`;
    } else {
        mediaContainer.innerHTML = "";
    }
    
    viewModal.classList.remove("hidden");
  } else {
    // Open the Application Modal
    document.getElementById("blockNumber").value = id;
    document.getElementById("selected-block-text").textContent = `Coordinate #${id}: Apply to Bid`;
    inquiryModal.classList.remove("hidden");
  }
}

// ================= SUBMIT APPLICATION =================
async function handleInquiry() {
  const btn = document.getElementById("uploadBtn");
  const blockId = document.getElementById("blockNumber").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const name = document.getElementById("name").value.trim();
  const message = document.getElementById("message").value;

  if (!email || !name) return alert("Credentials required.");
  
  btn.disabled = true;
  btn.textContent = "Etching Application...";

  try {
    await addDoc(collection(db, "inquiries"), {
      coordinate: blockId,
      bidderEmail: email,
      bidderName: name,
      message: message,
      timestamp: serverTimestamp(),
      status: "reviewing"
    });

    if (window.emailjs) {
      await emailjs.send("service_pmuwoaa", "template_xraan78", {
        name: name, email: email, coordinate: blockId, note: "New bid application."
      });
    }

    alert("Application Logged. The Curator will review your credentials.");
    document.getElementById("modal").classList.add("hidden");
    
    // clear form
    document.getElementById("email").value = "";
    document.getElementById("name").value = "";
    document.getElementById("message").value = "";

  } catch (err) {
    console.error(err);
    alert("Vault restricted. Try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Application to Bid";
  }
}

// ================= THE GENESIS KEY CHECK (FIXED) =================
async function verifyAccessKey() {
    const email = document.getElementById("loginEmailInput").value.trim().toLowerCase();
    const enteredKey = document.getElementById("loginKeyInput").value.trim();
    const loginBtn = document.getElementById("loginSendBtn");

    if (!email || !enteredKey) {
        alert("Credentials required for coordinate access.");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying...";

    try {
        const bidderRef = doc(db, "authorized_bidders", email);
        const snap = await getDoc(bidderRef);

        if (snap.exists()) {
            const data = snap.data();
            // Check exact key match
            if (data.accessKey === enteredKey) {
                
                // 1. Set Session
                localStorage.setItem('vault_session', JSON.stringify({ 
                    email: email, 
                    expiresAt: Date.now() + 21600000 // 6 hour session
                }));

                // 2. Alert User
                alert(`✅ Access Granted. Welcome, ${data.bidderName || "Keeper"}.`);
                
                // 3. Update UI immediately (NO RELOAD)
                checkSession(); 
                
                // 4. Close Modal
                document.getElementById("loginModal").classList.add("hidden");

            } else {
                alert("❌ Invalid Access Key.");
            }
        } else {
            alert("❌ Credentials not recognized.");
        }
    } catch (err) {
        console.error("Verification error:", err);
        alert("Verification restricted.");
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Verify Identity";
    }
}

// ================= ACCORDION MENU LOGIC (UPDATED) =================
function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    
    headers.forEach(header => {
        // We clone to remove any old listeners if this runs twice
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.onclick = function() {
            // SPECIAL CASE: The Login/Logout Button
            if (this.id === "menuLoginBtn") {
                if (loggedInUserEmail) {
                    // LOGOUT LOGIC: If they are already logged in...
                    if(confirm("Sever connection to the Vault?")) {
                        localStorage.removeItem('vault_session');
                        loggedInUserEmail = null;
                        alert("Connection Severed.");
                        location.reload(); // Refresh to reset the page state
                    }
                    return; // Stop here, don't try to open the accordion
                } else {
                    // LOGIN LOGIC: If they are NOT logged in...
                    document.getElementById("loginModal").classList.remove("hidden");
                    return; // Stop here
                }
            }

            // STANDARD ACCORDION LOGIC (For all other buttons)
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            
            if (content && content.classList.contains("accordion-content")) {
                if (content.style.maxHeight) {
                    // CLOSE IT
                    content.style.maxHeight = null;
                    content.style.opacity = 0;
                    content.classList.remove("open");
                } else {
                    // OPEN IT
                    content.style.maxHeight = content.scrollHeight + "px";
                    content.style.opacity = 1;
                    content.classList.add("open");
                }
            }
        };
    });
}


// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Check Session immediately
  checkSession();

  // 2. Auth state (Anonymous for public view)
  onAuthStateChanged(auth, (user) => { if (!user) signInAnonymously(auth); });

  // 3. Load Data & Run Loader
  loadVault();
  performHandshake();

  // 4. Initialize Accordion Menu
  initAccordion();

  // 5. Close Events
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");
  const loginModal = document.getElementById("loginModal");

  if(document.querySelector(".close-button")) 
      document.querySelector(".close-button").onclick = () => modal.classList.add("hidden");
  
  if(document.querySelector(".close-view")) 
      document.querySelector(".close-view").onclick = () => viewModal.classList.add("hidden");
  
  const closeLogin = document.querySelector(".close-login");
  if (closeLogin) closeLogin.onclick = () => loginModal.classList.add("hidden");

  // 6. Action Buttons
  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.onclick = handleInquiry;

  const loginSendBtn = document.getElementById("loginSendBtn");
  if (loginSendBtn) loginSendBtn.onclick = verifyAccessKey;

  // 7. Side Menu
  document.getElementById("menuToggle").onclick = () => document.getElementById("sideMenu").classList.add("open");
  document.getElementById("closeMenu").onclick = () => document.getElementById("sideMenu").classList.remove("open");
});
