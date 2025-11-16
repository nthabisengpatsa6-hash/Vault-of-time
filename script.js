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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const blocksCollection = collection(db, "blocks");

let claimedBlocks = [];
let selectedBlockNumber = null;
let storedFormData = null;

const blockPrice = 6.00;

// ============================================================================
// FIRESTORE
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

async function fetchBlockData(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

async function saveBlock(num, message, mediaURL, mediaType) {
  await setDoc(doc(blocksCollection, String(num)), {
    message: message || null,
    mediaURL: mediaURL || null,
    mediaType: mediaType || null,
    purchasedAt: serverTimestamp()
  });
}

// ============================================================================
// MAIN
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {

  // 1 — Check URL for PayPal redirect FIRST
  const params = new URLSearchParams(window.location.search);
  if (params.get("paypalSuccess") === "true") {
    const block = Number(params.get("block"));
    await finalizeCheckout(block);
    return;
  }

  // 2 — Safe load claimed blocks
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocksFromFirestore();

  // 3 — DOM refs
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const msgInput = document.getElementById("message");
  const paypalContainer = document.getElementById("paypal-button-container");
  const uploadBtn = document.getElementById("uploadBtn");

  // 4 — Build Grid
  grid.innerHTML = "";
  for (let i = 1; i <= 100; i++) {
    const div = document.createElement("div");
    div.classList.add("block");
    div.textContent = i;
    if (claimedBlocks.includes(i)) {
      div.classList.add("claimed");
      div.style.cursor = "not-allowed";
    } else {
      div.addEventListener("click", () => selectBlock(i));
    }
    grid.appendChild(div);
  }

  function selectBlock(num) {
    selectedBlockNumber = num;
    document.getElementById("blockNumber").value = num;
    document.getElementById("selected-block-text").textContent = `Selected Block: #${num}`;
    modal.classList.remove("hidden");
  }

  // 5 — Validate form + file
  function validate() {
    return (
      document.getElementById("name").value.trim() &&
      document.getElementById("email").value.trim() &&
      document.getElementById("fileUpload").files.length > 0
    );
  }

  function validateFile() {
    const f = document.getElementById("fileUpload").files[0];
    return f && f.size <= 2 * 1024 * 1024;
  }

  // 6 — Show PayPal button
  uploadBtn.addEventListener("click", () => {
    if (!validateFile()) return alert("File too large (max 2MB)");
    if (!validate()) return;

    renderPayPalButton();
  });

  function renderPayPalButton() {
    paypalContainer.innerHTML = "";
    paypal.Buttons({
      style: { color: "gold", shape: "pill", label: "pay", height: 45 },
      createOrder: (data, actions) => {
        storedFormData = {
          name: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          message: msgInput.value.trim()
        };

        sessionStorage.setItem("vaultForm", JSON.stringify(storedFormData));

        return actions.order.create({
          purchase_units: [{
            description: `Vault Block #${selectedBlockNumber}`,
            amount: { value: blockPrice.toFixed(2) }
          }],
          application_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: `${location.origin}${location.pathname}?paypalSuccess=true&block=${selectedBlockNumber}`,
            cancel_url: `${location.origin}${location.pathname}`
          }
        });
      },
      onApprove: (data, actions) => actions.redirect()
    }).render("#paypal-button-container");
  }

  // ========================================================================
  // FINALIZE — Only called AFTER redirect back
  // ========================================================================
  async function finalizeCheckout(blockNum) {
    const formData = JSON.parse(sessionStorage.getItem("vaultForm"));
    if (!formData) {
      alert("Error: Missing block data.");
      return location.replace(location.pathname);
    }

    let mediaURL = null;
    let mediaType = null;
    const uploadField = document.getElementById("fileUpload");

    // Only upload if the file still exists
    if (uploadField && uploadField.files.length > 0) {
      const file = uploadField.files[0];
      const storagePath = ref(storage, `blocks/${blockNum}/${file.name}`);

      await uploadBytes(storagePath, file);
      mediaURL = await getDownloadURL(storagePath);
      mediaType = file.type;
    }

    await saveBlock(blockNum, formData.message, mediaURL, mediaType);

    claimedBlocks.push(blockNum);
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

    alert(`Block #${blockNum} sealed in the Vault.`);

    location.replace(location.pathname);
  }
});
