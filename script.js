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

// ================= THE "SECURITY HANDSHAKE" LOADER =================
function performHandshake() {
  const loaderText = document.querySelector(".vault-loader-text");
  const messages = [
    "Verifying Curation Standards...",
    "Syncing with the Ledger...",
    "Authenticating Genesis Coordinates...",
    "Opening the Vault."
  ];
  let i = 0;
  
  const interval = setInterval(() => {
    if (loaderText) {
      loaderText.style.opacity = 0; 
      setTimeout(() => {
        loaderText.textContent = messages[i];
        loaderText.style.opacity = 1; 
        i++;
      }, 300);
    }
    
    if (i >= messages.length) {
      clearInterval(interval);
      setTimeout(hideLoader, 800); 
    }
  }, 1400); 
}

function hideLoader() {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");
  if (loader) {
    loader.style.opacity = 0;
    setTimeout(() => loader.remove(), 600);
  }
  if (main) main.classList.add("vault-main-visible");
}

// ================= SESSION & AUTH =================
function checkSession() {
    const session = localStorage.getItem('vault_session');
    if (session) {
        const { email, expiresAt } = JSON.parse(session);
        if (Date.now() < expiresAt) {
            loggedInUserEmail = email;
            const loginBtn = document.getElementById("menuLoginBtn");
            if (loginBtn) {
                loginBtn.textContent = `👤 ${email.split('@')[0]}`;
                loginBtn.style.color = "#4CAF50";
            }
        } else {
            localStorage.removeItem('vault_session');
        }
    }
}

// ================= THE AUCTION RATCHET =================
async function getCurrentFloorPrice() {
  const q = query(collection(db, "blocks"), where("status", "==", "paid"), orderBy("purchasePrice", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 1000; 
  const lastPrice = snap.docs[0].data().purchasePrice;
  return Math.ceil(lastPrice * 1.1); 
}

// ================= CORE DATA FETCH =================
async function loadVault() {
  const snap = await getDocs(collection(db, "blocks"));
  claimed = [];
  blockCache = {};
  
  snap.forEach(d => {
    const data = d.data();
    blockCache[d.id] = data;
    if (data.status === "paid") claimed.push(Number(d.id));
  });
  renderGrid();
}

// ================= GALLERY RENDERING =================
async function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";
  const floorPrice = await getCurrentFloorPrice();

  for (let i = 1; i <= TOTAL_BLOCKS; i++) {
    const div = document.createElement("div");
    div.className = "block";
    div.innerHTML = `<span class="coord-num">#${i}</span>`;
    
    if (claimed.includes(i)) {
      div.classList.add("claimed");
      const data = blockCache[i];
      if (data.mediaUrl && data.mediaType === "image") {
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

// ================= THE INQUIRY & UPDATE ENGINE =================
async function handleCoordinateClick(id, price) {
  const data = blockCache[id];
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");
  const uploadBtn = document.getElementById("uploadBtn");
  
  // CASE 1: BLOCK IS PAID
  if (data && data.status === "paid") {
    // Check if the current logged-in user is the OWNER
    if (loggedInUserEmail && data.ownerEmail === loggedInUserEmail) {
      document.getElementById("blockNumber").value = id;
      document.getElementById("selected-block-text").textContent = `Edit Coordinate #${id}`;
      uploadBtn.textContent = "Update Legacy";
      modal.classList.remove("hidden");
    } else {
      document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
      document.getElementById("viewBlockMessage").textContent = data.message || "A silent legacy.";
      const mediaContainer = document.getElementById("viewBlockMedia");
      mediaContainer.innerHTML = data.mediaType === "image" ? `<img src="${data.mediaUrl}" style="width:100%">` : "";
      viewModal.classList.remove("hidden");
    }
  } 
  // CASE 2: BLOCK IS AVAILABLE
  else {
    document.getElementById("blockNumber").value = id;
    document.getElementById("selected-block-text").textContent = `Coordinate #${id}: Apply to Bid`;
    uploadBtn.textContent = "Submit Application to Bid";
    modal.classList.remove("hidden");
  }
}

// ================= SUBMIT APPLICATION OR UPDATE =================
async function handleAction() {
  const btn = document.getElementById("uploadBtn");
  const blockId = document.getElementById("blockNumber").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const name = document.getElementById("name").value.trim();
  const msg = document.getElementById("message").value;

  if (!email || !name) return alert("Credentials required.");
  
  btn.disabled = true;

  // IF UPDATING EXISTING OWNED BLOCK
  if (btn.textContent === "Update Legacy") {
    btn.textContent = "Updating Ledger...";
    try {
        await updateDoc(doc(db, "blocks", blockId), {
            message: msg,
            updatedAt: serverTimestamp()
        });
        alert("✅ Legacy Updated.");
        location.reload();
    } catch (err) { alert("Update failed."); btn.disabled = false; }
  } 
  // IF APPLYING FOR NEW AUCTION
  else {
    btn.textContent = "Etching Application...";
    try {
      await addDoc(collection(db, "inquiries"), {
        coordinate: blockId,
        bidderEmail: email,
        bidderName: name,
        message: msg,
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
    } catch (err) { alert("Vault restricted."); } 
    finally { btn.disabled = false; btn.textContent = "Submit Application to Bid"; }
  }
}

// ================= THE GENESIS KEY CHECK =================
async function verifyAccessKey() {
    const email = document.getElementById("loginEmailInput").value.trim().toLowerCase();
    const enteredKey = document.getElementById("loginKeyInput").value.trim();
    const loginBtn = document.getElementById("loginSendBtn");

    if (!email || !enteredKey) return alert("Credentials required.");

    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying...";

    try {
        const bidderRef = doc(db, "authorized_bidders", email);
        const snap = await getDoc(bidderRef);

        if (snap.exists() && snap.data().accessKey === enteredKey) {
            localStorage.setItem('vault_session', JSON.stringify({ 
                email: email, 
                expiresAt: Date.now() + 21600000 
            }));
            alert(`✅ Access Granted. Welcome, ${snap.data().bidderName || "Keeper"}.`);
            location.reload(); 
        } else {
            alert("❌ Invalid Access Key.");
        }
    } catch (err) { alert("Verification restricted."); } 
    finally { loginBtn.disabled = false; loginBtn.textContent = "Request Access"; }
}

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  onAuthStateChanged(auth, (user) => { if (!user) signInAnonymously(auth); });

  loadVault();
  performHandshake();

  // Modal Closers
  document.querySelector(".close-button").onclick = () => document.getElementById("modal").classList.add("hidden");
  document.querySelector(".close-view").onclick = () => document.getElementById("viewModal").classList.add("hidden");
  const closeLogin = document.querySelector(".close-login");
  if (closeLogin) closeLogin.onclick = () => document.getElementById("loginModal").classList.add("hidden");

  // Action Buttons
  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.onclick = handleAction;

  const loginSendBtn = document.getElementById("loginSendBtn");
  if (loginSendBtn) loginSendBtn.onclick = verifyAccessKey;

  // Menu
  document.getElementById("menuToggle").onclick = () => document.getElementById("sideMenu").classList.add("open");
  document.getElementById("closeMenu").onclick = () => document.getElementById("sideMenu").classList.remove("open");
});
