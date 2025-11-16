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
const blocksCollection = collection(db, "blocks");

// Local cache of claimed blocks
let claimedBlocks = [];

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snap = await getDocs(blocksCollection);
    claimedBlocks = snap.docs.map(d => Number(d.id));
    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
  } catch (err) {
    console.error("Error loading Firestore:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

async function saveBlockToFirestore(blockNumber, name, email, message) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      message: message || null,
      purchasedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed saving block:", err);
  }
}

async function fetchBlockData(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    if (snap.exists()) return snap.data();
    return null;
  } catch (err) {
    console.error("Error fetching block:", err);
    return null;
  }
}

// ============================================================================
// MAIN APP
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // ---------- LOADING OVERLAY ----------
  const loadingOverlay = document.createElement("div");
  Object.assign(loadingOverlay.style, {
    position: "fixed",
    inset: "0",
    background:
      "radial-gradient(circle at top, #141922 0%, #05070b 55%, #020308 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "9999",
    color: "#f9d26e",
    fontFamily: "system-ui",
    transition: "opacity .4s ease"
  });
  loadingOverlay.innerHTML = `
    <div style="font-size:42px;margin-bottom:10px;">🕰️</div>
    <div style="font-size:20px;font-weight:600;margin-bottom:4px;">The Vault is opening…</div>
    <div style="font-size:14px;opacity:0.8;">Loading memory blocks…</div>
  `;
  document.body.appendChild(loadingOverlay);

  const hideOverlay = () => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => loadingOverlay.remove(), 400);
  };

  // ---------- DOM REFS ----------
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");
  const messageInput = document.getElementById("message"); // 💥 correct ID
  const viewModal = document.getElementById("viewModal");
  const viewClose = document.querySelector(".close-view");
  const viewBlockTitle = document.getElementById("viewBlockTitle");
  const viewBlockMessage = document.getElementById("viewBlockMessage");
  const viewBlockMeta = document.getElementById("viewBlockMeta");
  const viewBlockMedia = document.getElementById("viewBlockMedia");

  const paypalContainer = document.getElementById("paypal-button-container");
  const readyMsg = document.getElementById("ready-message");
  const uploadBtn = document.getElementById("uploadBtn");

  const blockPrice = 6.0;
  let selectedBlockNumber = null;
  let paypalButtonsInstance = null;

  // ---------- LOAD CLAIMED BLOCKS ----------
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  await loadClaimedBlocksFromFirestore();

  // ---------- BUILD GRID ----------
  function buildGrid() {
    grid.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
      const block = document.createElement("div");
      block.classList.add("block");
      block.textContent = i;

      if (claimedBlocks.includes(i)) {
        block.classList.add("claimed");
        block.style.cursor = "not-allowed";
      }

      grid.appendChild(block);
    }
  }

  buildGrid();

  function refreshClaimedStyles() {
    document.querySelectorAll(".block").forEach(div => {
      const num = Number(div.textContent);
      if (claimedBlocks.includes(num)) {
        div.classList.add("claimed");
        div.style.cursor = "not-allowed";
        div.classList.remove("selected");
      }
    });
  }
  refreshClaimedStyles();

  // ---------- BLOCK CLICK HANDLING ----------
  function attachBlockHandlers() {
    document.querySelectorAll(".block").forEach(block => {
      block.addEventListener("click", async () => {
        const num = Number(block.textContent);
        if (!num) return;

        // If already claimed -> open view modal
        if (claimedBlocks.includes(num)) {
          const data = await fetchBlockData(num);

          viewBlockTitle.textContent = `Block #${num}`;
          viewBlockMedia.innerHTML = ""; // media coming in V2

          if (data?.message) {
            viewBlockMessage.textContent = data.message;
          } else {
            viewBlockMessage.textContent = "No message has been added to this block yet.";
          }

          if (data?.name || data?.purchasedAt) {
            let meta = "";
            if (data.name) meta += `Claimed by ${data.name}`;
            if (data.purchasedAt?.toDate) {
              const d = data.purchasedAt.toDate();
              meta += meta ? " · " : "";
              meta += `on ${d.toLocaleDateString()}`;
            }
            viewBlockMeta.textContent = meta;
          } else {
            viewBlockMeta.textContent = "";
          }

          viewModal.classList.remove("hidden");
          return;
        }

        // If free -> open purchase modal
        document.querySelectorAll(".block").forEach(b => b.classList.remove("selected"));
        block.classList.add("selected");

        selectedBlockNumber = num;
        document.getElementById("blockNumber").value = num;
        document.getElementById("selected-block-text").textContent =
          `Selected Block: #${num}`;

        modal.classList.remove("hidden");
      });
    });
  }

  attachBlockHandlers();

  // ---------- MODAL CLOSE ----------
  closeButton?.addEventListener("click", () => modal.classList.add("hidden"));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  viewClose?.addEventListener("click", () => viewModal.classList.add("hidden"));
  viewModal?.addEventListener("click", (e) => {
    if (e.target === viewModal) viewModal.classList.add("hidden");
  });

  // ---------- FORM / PAY VALIDATION ----------
  function validateFileSize() {
    const f = document.getElementById("fileUpload").files[0];
    if (!f) return false;
    if (f.size > 2 * 1024 * 1024) {
      alert("❌ Your file is larger than 2MB.");
      document.getElementById("fileUpload").value = "";
      return false;
    }
    return true;
  }

  function canCheckout() {
    return (
      document.getElementById("name").value.trim() &&
      document.getElementById("email").value.trim() &&
      document.getElementById("fileUpload").files.length > 0 &&
      selectedBlockNumber
    );
  }

  function updateGate() {
    if (!validateFileSize()) {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
      return;
    }

    if (canCheckout()) {
      readyMsg.classList.add("show");
      paypalContainer.classList.add("show");

      if (!paypalButtonsInstance && window.paypal) {
        paypalButtonsInstance = window.paypal.Buttons({
          // single button – PayPal decides card vs wallet
          createOrder: (data, actions) => {
            return actions.order.create({
              purchase_units: [{
                description: `Vault Block #${selectedBlockNumber}`,
                amount: { value: blockPrice.toFixed(2) }
              }]
            });
          },
          onApprove: async (data, actions) => {
            const details = await actions.order.capture();
            await handleSuccessfulPayment(details);
          },
          onError: (err) => {
            console.error("PayPal error:", err);
            alert("Payment error – please try again.");
          }
        });

        paypalButtonsInstance.render("#paypal-button-container");
      }
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  form?.addEventListener("input", updateGate, true);
  form?.addEventListener("change", updateGate, true);
  uploadBtn?.addEventListener("click", updateGate);

  // ---------- SUCCESS HANDLER ----------
  async function handleSuccessfulPayment(details) {
    alert(`✅ Payment completed by ${details?.payer?.name?.given_name || "payer"}.`);

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = messageInput?.value.trim() || null;

    await saveBlockToFirestore(selectedBlockNumber, name, email, message);

    if (!claimedBlocks.includes(selectedBlockNumber)) {
      claimedBlocks.push(selectedBlockNumber);
      localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    }

    refreshClaimedStyles();
    modal.classList.add("hidden");
    generateCertificatePDF(name, selectedBlockNumber);
  }

  // ---------- CERTIFICATE ----------
  function generateCertificatePDF(name, blockNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, W, H, "F");

    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(6);
    doc.rect(30, 30, W - 60, H - 60);

    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.text("Vault Of Time Certificate of Ownership", W / 2, 120, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("This certifies that", W / 2, 200, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(26);
    doc.text(name, W / 2, 240, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text(`is the rightful guardian of Block #${blockNumber}`, W / 2, 280, { align: "center" });
    doc.text("Sealed within The Vault.", W / 2, 310, { align: "center" });

    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, W / 2, 360, { align: "center" });

    doc.save(`VaultOfTime_Block${blockNumber}.pdf`);
  }

  // ---------- SIDE MENU ----------
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  menuToggle?.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
    menuToggle.classList.add("active");
  });

  closeMenu?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
    menuToggle.classList.remove("active");
  });

  overlay?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
    menuToggle.classList.remove("active");
  });

  // ---------- ACCORDION ----------
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = header.classList.contains("active");

      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));

      if (!isOpen) {
        header.classList.add("active");
        content.classList.add("show");
      }
    });
  });

  hideOverlay();
});
