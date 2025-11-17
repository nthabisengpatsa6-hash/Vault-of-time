console.log("Vault of Time loaded");

// === FIREBASE IMPORTS ======================
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

// === FIREBASE CONFIG ======================
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

let claimedBlocks = [];

// === FIRESTORE ============================
async function loadClaimedBlocks() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function saveBlock(blockNumber, name, email, message) {
  await setDoc(doc(blocksCollection, String(blockNumber)), {
    name,
    email,
    message: message || null,
    purchasedAt: serverTimestamp()
  });
}

async function fetchBlock(num) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(num)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// === DOM LOAD =============================
document.addEventListener("DOMContentLoaded", async () => {

  // LOADING SPLASH
  const splash = document.createElement("div");
  splash.style = `
    position:fixed;inset:0;display:flex;
    flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(circle,#141922,#05070b);
    z-index:9999;color:#f9d26e;font-size:20px;
    transition:opacity .4s;
  `;
  splash.innerHTML = `<div style="font-size:50px">🕰️</div><div>Opening the Vault…</div>`;
  document.body.appendChild(splash);
  const hideSplash = () => {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 350);
  };

  // DOM refs
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const viewModal = document.getElementById("viewModal");

  const closeBtn = document.querySelector(".close-button");
  const viewCloseBtn = document.querySelector(".close-view");

  const blockNumInput = document.getElementById("blockNumber");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("fileUpload");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  const viewTitle = document.getElementById("viewBlockTitle");
  const viewMsg = document.getElementById("viewBlockMessage");

  let selected = null;
  const blockPrice = 6.00;
  const paypalEmail = "hello@vaultoftime.com";

  // Load claimed
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocks();

  // GRID
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const div = document.createElement("div");
      div.className = "block";
      div.textContent = i;

      if (claimedBlocks.includes(i)) div.classList.add("claimed");

      grid.appendChild(div);
    }
  }
  buildGrid();

  function refreshGrid() {
    document.querySelectorAll(".block").forEach(b => {
      const num = Number(b.textContent);
      if (claimedBlocks.includes(num)) {
        b.classList.add("claimed");
        b.classList.remove("selected");
      }
    });
  }

  // CLICK BLOCK
  grid.addEventListener("click", async e => {
    if (!e.target.classList.contains("block")) return;
    const num = Number(e.target.textContent);

    if (claimedBlocks.includes(num)) {
      const data = await fetchBlock(num);
      viewTitle.textContent = `Block #${num}`;
      viewMsg.textContent = data?.message || "(no message)";
      viewModal.classList.remove("hidden");
      return;
    }

    // Free block
    document.querySelectorAll(".block").forEach(b =>
      b.classList.remove("selected")
    );

    e.target.classList.add("selected");
    selected = num;
    blockNumInput.value = num;

    document.getElementById("selected-block-text").textContent =
      `Selected Block: #${num}`;

    modal.classList.remove("hidden");
  });

  // CLOSE MODALS
  closeBtn.onclick = () => modal.classList.add("hidden");
  viewCloseBtn.onclick = () => viewModal.classList.add("hidden");

  // FORM CHECK
  function valid() {
    return (
      nameInput.value.trim() &&
      emailInput.value.trim() &&
      selected &&
      fileInput.files.length > 0
    );
  }

  function fileOK() {
    const f = fileInput.files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("File too large (2MB max)");
      return false;
    }
    return true;
  }

  // SHOW PAY BUTTON
  document.getElementById("uploadBtn").onclick = () => {
    if (!fileOK()) return;
    if (valid()) {
      readyMsg.classList.add("show");
      paypalContainer.classList.add("show");
    }
  };

  // === PAY BUTTON LOGIC (NEW) ===================
  paypalContainer.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const msg = messageInput.value.trim();

    if (!valid()) {
      alert("Fill in your details first.");
      return;
    }

    const paypalLink = new URL("https://www.paypal.com/cgi-bin/webscr");
    paypalLink.searchParams.set("cmd", "_xclick");
    paypalLink.searchParams.set("business", paypalEmail);
    paypalLink.searchParams.set("item_name", `Vault Block #${selected}`);
    paypalLink.searchParams.set("amount", blockPrice.toFixed(2));
    paypalLink.searchParams.set("currency_code", "USD");

    paypalLink.searchParams.set("return", "https://vaultoftime.com");
    paypalLink.searchParams.set("cancel_return", "https://vaultoftime.com");

    // External checkout
    window.open(paypalLink.toString(), "_blank");

    // TEMP: assume success after 4s
    setTimeout(async () => {
      await saveBlock(selected, name, email, msg);
      claimedBlocks.push(selected);
      localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
      modal.classList.add("hidden");
      refreshGrid();
    }, 4000);
  });

  // ACCORDION
  document.querySelectorAll(".accordion-header").forEach(h => {
    h.addEventListener("click", () => {
      const open = h.classList.contains("active");
      document.querySelectorAll(".accordion-header").forEach(a => a.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
      if (!open) {
        h.classList.add("active");
        h.nextElementSibling.classList.add("show");
      }
    });
  });

  // MENU
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");

  menuToggle.onclick = () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  };
  document.getElementById("closeMenu").onclick = () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  };
  overlay.onclick = () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  };

  // Remove splash
  hideSplash();
});
