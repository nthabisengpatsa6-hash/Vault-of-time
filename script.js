// === FIREBASE IMPORTS & SETUP ===============================================
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

// Firebase Config -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDo9YzptBrAvJy7hjiGh1YSy20lZzOKVZc",
  authDomain: "vault-of-time-e6c03.firebaseapp.com",
  projectId: "vault-of-time-e6c03",
  storageBucket: "vault-of-time-e6c03.firebasestorage.app",
  messagingSenderId: "941244238426",
  appId: "1:941244238426:web:80f80b5237b84b1740e663"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const blocksCollection = collection(db, "blocks");

let claimedBlocks = [];
let selectedBlockNumber = null;
let storedFormData = null;
const blockPrice = 6.00;

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch {
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function fetchBlockData(blockNumber) {
  const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
  return snap.exists() ? snap.data() : null;
}

async function saveBlockToFirestore(blockNumber, message, mediaURL, mediaType) {
  await setDoc(doc(blocksCollection, String(blockNumber)), {
    message: message || null,
    mediaURL: mediaURL || null,
    mediaType: mediaType || null,
    purchasedAt: serverTimestamp()
  });
}

// ============================================================================
// MAIN APP
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {

  // URL CHECK — PAYPAL RETURN
  const params = new URLSearchParams(window.location.search);
  if (params.get("paypalSuccess") === "true") {
    const block = Number(params.get("block"));
    await finalizeCheckout(block);
    return;
  }

  // Load claimed blocks
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocksFromFirestore();

  // DOM refs
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const messageInput = document.getElementById("message");
  const paypalContainer = document.getElementById("paypal-button-container");
  const uploadBtn = document.getElementById("uploadBtn");

  // Build grid
  grid.innerHTML = "";
  for (let i = 1; i <= 100; i++) {
    const div = document.createElement("div");
    div.classList.add("block");
    div.textContent = i;
    if (claimedBlocks.includes(i)) {
      div.classList.add("claimed");
      div.style.cursor = "not-allowed";
    }
    div.addEventListener("click", () => handleBlockClick(i));
    grid.appendChild(div);
  }

  function handleBlockClick(num) {
    if (claimedBlocks.includes(num)) return;

    selectedBlockNumber = num;
    document.getElementById("blockNumber").value = num;
    document.getElementById("selected-block-text").textContent = `Selected Block: #${num}`;
    modal.classList.remove("hidden");
  }

  // File + form validation
  function canCheckout() {
    return (
      document.getElementById("name").value.trim() &&
      document.getElementById("email").value.trim() &&
      document.getElementById("fileUpload").files.length > 0 &&
      selectedBlockNumber
    );
  }

  function validateFileSize() {
    const f = document.getElementById("fileUpload").files[0];
    if (!f) return false;
    return f.size <= 2 * 1024 * 1024;
  }

  // When ready, show PayPal
  uploadBtn.addEventListener("click", () => {
    if (!validateFileSize()) {
      alert("File too large (2MB max)");
      return;
    }
    if (canCheckout()) {
      renderPayPalRedirectButton();
    }
  });

  // REDIRECT-BASED PAYPAL BUTTON
  function renderPayPalRedirectButton() {
    paypalContainer.innerHTML = "";

    paypal.Buttons({
      style: {
        color: "gold",
        shape: "pill",
        label: "pay",
        height: 45
      },

      createOrder: (data, actions) => {
        // STORE FORM DATA
        storedFormData = {
          name: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          message: messageInput.value.trim() || null
        };

        sessionStorage.setItem("vaultForm", JSON.stringify(storedFormData));

        return actions.order.create({
          purchase_units: [{
            description: `Vault Block #${selectedBlockNumber}`,
            amount: { value: blockPrice.toFixed(2) }
          }],
          application_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: `${window.location.origin}${window.location.pathname}?paypalSuccess=true&block=${selectedBlockNumber}`,
            cancel_url: `${window.location.origin}${window.location.pathname}`
          }
        });
      },

      onApprove: (data, actions) => {
        return actions.redirect();
      }

    }).render("#paypal-button-container");
  }

  // FINALIZE AFTER REDIRECT BACK
  async function finalizeCheckout(blockNumber) {
    const formData = JSON.parse(sessionStorage.getItem("vaultForm"));
    if (!formData) return alert("Error: Missing form data.");

    const file = document.getElementById("fileUpload")?.files[0];
    let mediaURL = null;
    let mediaType = null;

    if (file) {
      const storageRef = ref(storage, `blocks/${blockNumber}/${file.name}`);
      await uploadBytes(storageRef, file);
      mediaURL = await getDownloadURL(storageRef);
      mediaType = file.type;
    }

    await saveBlockToFirestore(
      blockNumber,
      formData.message,
      mediaURL,
      mediaType
    );

    claimedBlocks.push(blockNumber);
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

    alert(`Block #${blockNumber} sealed!`);

    window.location.href = window.location.pathname;
  }
});
