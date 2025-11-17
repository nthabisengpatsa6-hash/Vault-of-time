console.log("Vault JS active");

// === FIREBASE IMPORTS ================================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
const blocksCollection = collection(db, "blocks");

let claimed = [];

// === LOAD CLAIMED BLOCKS =============================
async function load() {
  const snap = await getDocs(blocksCollection);
  claimed = snap.docs.map(d => Number(d.id));
  localStorage.setItem("claimed", JSON.stringify(claimed));
}

// === SAVE BLOCK ======================================
async function saveBlock(num, name, email, msg) {
  await setDoc(doc(blocksCollection, String(num)), {
    name,
    email,
    message: msg || null,
    purchasedAt: serverTimestamp()
  });
}

// === FETCH BLOCK =====================================
async function fetchBlock(num) {
  const snap = await getDoc(doc(blocksCollection, String(num)));
  return snap.exists() ? snap.data() : null;
}

// === MAIN APP ========================================
document.addEventListener("DOMContentLoaded", async () => {
  const blockForm = document.getElementById("blockForm");
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");
  const viewClose = document.querySelector(".close-view");
  const closeBtn = document.querySelector(".close-button");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");

  const readyMsg = document.getElementById("ready-message");
  const payButton = document.getElementById("payButton");

  let selected = null;
  const price = 6.0;
  const seller = "hello@vaultoftime.com";

  claimed = JSON.parse(localStorage.getItem("claimed")) || [];
  await load();

  // === GRID ========================================
  function renderGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;

      if (claimed.includes(i)) {
        div.classList.add("claimed");
      }

      div.onclick = async () => {
        if (claimed.includes(i)) {
          const data = await fetchBlock(i);
          document.getElementById("viewBlockTitle").textContent = `Block #${i}`;
          document.getElementById("viewBlockMessage").textContent = data.message || "";
          document.getElementById("viewBlockMedia").innerHTML = "";
          viewModal.classList.remove("hidden");
          return;
        }

        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        div.classList.add("selected");

        selected = i;
        document.getElementById("blockNumber").value = i;
        document.getElementById("selected-block-text").textContent = `Selected Block: #${i}`;
        modal.classList.remove("hidden");
      };

      grid.appendChild(div);
    }
  }

  renderGrid();

  // === CLOSE MODALS =================================
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewClose.onclick = () => viewModal.classList.add("hidden");

  // === VALIDATION ===================================
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      fileInput.files.length > 0 &&
      selected
    );
  }

  function updateGate() {
    if (valid()) {
      readyMsg.classList.add("show");
      payButton.style.display = "block";
    }
  }

  document.getElementById("uploadBtn").onclick = updateGate;
  blockForm.addEventListener("input", updateGate, true);

  // === PAYMENT BUTTON ===============================
  payButton.onclick = async () => {
    const url =
      `https://www.paypal.com/ncp/payment/${seller}?amount=${price}&currency=USD&item_name=Vault+Block+%23${selected}`;

    window.open(url, "_blank");

    setTimeout(async () => {
      await saveBlock(
        selected,
        nameInput.value,
        emailInput.value,
        messageInput.value
      );

      claimed.push(selected);
      localStorage.setItem("claimed", JSON.stringify(claimed));

      modal.classList.add("hidden");
      renderGrid();
    }, 4000);
  };
});


// === VAULT LOADING SCREEN LOGIC ======================
window.addEventListener("load", () => {
  const loader = document.getElementById("vault-loader");
  const main = document.getElementById("vault-main-content");

  if (!loader || !main) return;

  setTimeout(() => {
    loader.classList.add("vault-loader-hide");
    main.classList.add("vault-main-visible");

    // fully remove loader after fade
    setTimeout(() => loader.remove(), 700);
  }, 1200);
});
