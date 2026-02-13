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
  apiKey: "AIzaSyDo9YzptBrAvJy7hjiGh1YSy20lZzOKVZc", // Note: Restrict this in Firebase Console!
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
    if (loaderText) loaderText.textContent = messages[i];
    i++;
    if (i >= messages.length) {
      clearInterval(interval);
      hideLoader();
    }
  }, 600);
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

// ================= THE AUCTION RATCHET =================
async function getCurrentFloorPrice() {
  const q = query(collection(db, "blocks"), where("status", "==", "paid"), orderBy("purchasePrice", "desc"), limit(1));
  const snap = await getDocs(q);
  
  if (snap.empty) return 1000; // Starting bid for Block #1: $1,000
  
  const lastPrice = snap.docs[0].data().purchasePrice;
  return Math.ceil(lastPrice * 1.1); // Next block starts at 110% of last sale
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

// ================= THE INQUIRY ENGINE =================
async function handleCoordinateClick(id, price) {
  const data = blockCache[id];
  
  if (data && data.status === "paid") {
    // Show Legacy View (The Museum Modal)
    const viewModal = document.getElementById("viewModal");
    document.getElementById("viewBlockTitle").textContent = `Coordinate #${id}`;
    document.getElementById("viewBlockMessage").textContent = data.message || "A silent legacy.";
    const mediaContainer = document.getElementById("viewBlockMedia");
    mediaContainer.innerHTML = data.mediaType === "image" ? `<img src="${data.mediaUrl}" style="width:100%">` : "";
    viewModal.classList.remove("hidden");
  } else {
    // Show Auction Application Form
    const modal = document.getElementById("modal");
    document.getElementById("blockNumber").value = id;
    document.getElementById("selected-block-text").textContent = `Coordinate #${id}: Apply to Bid`;
    modal.classList.remove("hidden");
  }
}

// ================= SUBMIT APPLICATION (Replaces PayPal) =================
async function handleInquiry() {
  const saveBtn = document.getElementById("uploadBtn");
  const blockId = document.getElementById("blockNumber").value;
  const email = document.getElementById("email").value;
  const name = document.getElementById("name").value;
  
  if (!email || !name) return alert("Credentials required.");

  saveBtn.disabled = true;
  saveBtn.textContent = "Etching Application...";

  try {
    // 1. Log Inquiry in Firebase
    await addDoc(collection(db, "inquiries"), {
      coordinate: blockId,
      bidderEmail: email,
      bidderName: name,
      message: document.getElementById("message").value,
      timestamp: serverTimestamp(),
      status: "reviewing"
    });

    // 2. Alert the Curator (EmailJS)
    if (window.emailjs) {
      await emailjs.send("service_pmuwoaa", "template_xraan78", {
        name: name,
        email: email,
        coordinate: blockId,
        note: "A new bidder has applied for the Genesis 50."
      });
    }

    alert("Application Logged. The Curator will review your credentials.");
    document.getElementById("modal").classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("The Vault is currently restricted. Try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Submit Application to Bid";
  }
}

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) signInAnonymously(auth);
  });

  loadVault();
  performHandshake();

  // Attach Close Events
  document.querySelector(".close-button").onclick = () => document.getElementById("modal").classList.add("hidden");
  document.querySelector(".close-view").onclick = () => document.getElementById("viewModal").classList.add("hidden");
  
  // Attach Submit Logic
  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.onclick = handleInquiry;

  // Toggle Side Menu
  document.getElementById("menuToggle").onclick = () => document.getElementById("sideMenu").classList.add("open");
  document.getElementById("closeMenu").onclick = () => document.getElementById("sideMenu").classList.remove("open");
});
