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

// Expose Firestore globally (if you ever need it elsewhere)
window.db = db;

// Firestore "blocks" collection
const blocksCollection = collection(db, "blocks");

// Memory cache
let claimedBlocks = [];
let blockDataMap = {}; // { [blockNumber]: { name, email, message, mediaUrl, mediaType, ... } }

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================
async function loadClaimedBlocksFromFirestore() {
  try {
    const snapshot = await getDocs(blocksCollection);

    claimedBlocks = [];
    blockDataMap = {};

    snapshot.forEach((d) => {
      const idNum = Number(d.id);
      if (!Number.isNaN(idNum)) {
        claimedBlocks.push(idNum);
        blockDataMap[idNum] = { blockNumber: idNum, ...d.data() };
      }
    });

    localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
    console.log("Loaded claimed:", claimedBlocks);
  } catch (err) {
    console.error("Error loading Firestore:", err);
    claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  }
}

// Remote check before taking money
async function isBlockClaimedRemote(blockNumber) {
  try {
    const snap = await getDoc(doc(blocksCollection, String(blockNumber)));
    return snap.exists();
  } catch (err) {
    console.error("Error checking Firestore:", err);
    return claimedBlocks.includes(blockNumber);
  }
}

// Upload file to Firebase Storage and return { url, mediaType }
async function uploadFileForBlock(blockNumber, file) {
  if (!file) return { url: null, mediaType: null };

  const timestamp = Date.now();
  const cleanName = file.name.replace(/\s+/g, "_");
  const storageRef = ref(
    storage,
    `blocks/block_${blockNumber}/${timestamp}_${cleanName}`
  );

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  // Derive a simple media type bucket
  let mediaType = "other";
  if (file.type.startsWith("image/")) mediaType = "image";
  else if (file.type.startsWith("audio/")) mediaType = "audio";
  else if (file.type.startsWith("video/")) mediaType = "video";
  else if (file.type === "application/pdf" || cleanName.toLowerCase().endsWith(".pdf"))
    mediaType = "pdf";
  else if (file.type.startsWith("text/") || cleanName.toLowerCase().endsWith(".txt"))
    mediaType = "text";

  return { url, mediaType };
}

// Save block data in Firestore
async function saveBlockToFirestore(blockNumber, { name, email, message, mediaUrl, mediaType, originalFileName }) {
  try {
    await setDoc(doc(blocksCollection, String(blockNumber)), {
      name,
      email,
      message: message || "",
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      originalFileName: originalFileName || null,
      purchasedAt: serverTimestamp()
    });
    console.log("Saved block:", blockNumber);
  } catch (err) {
    console.error("Failed saving:", err);
  }
}

// ============================================================================
// APP START
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Vault script loaded.");

  // ------------------------------------------------------------------------
  // LOADING OVERLAY
  // ------------------------------------------------------------------------
  const loadingOverlay = document.createElement("div");
  loadingOverlay.id = "vault-loading-overlay";
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
    <div style="font-size:14px;opacity:0.8;">Fetching claimed blocks and preparing your grid.</div>
  `;
  document.body.appendChild(loadingOverlay);

  const hideLoadingOverlay = () => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => loadingOverlay.remove(), 400);
  };

  // ------------------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------------------
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  const viewModal = document.getElementById("viewModal");
  const viewModalContent = document.getElementById("viewModalContent");
  const closeViewBtn = viewModalContent?.querySelector(".close-view");
  const viewBlockTitle = document.getElementById("viewBlockTitle");
  const viewBlockMedia = document.getElementById("viewBlockMedia");
  const viewBlockMessage = document.getElementById("viewBlockMessage");
  const viewBlockMeta = document.getElementById("viewBlockMeta");

  const visibleRange = [1, 100];
  const founderBlock = 1;
  const blockPrice = 6.0;

  let selectedBlockNumber = null;

  // ------------------------------------------------------------------------
  // SEED FROM LOCAL FIRST (for instant grid)
  // ------------------------------------------------------------------------
  claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // ------------------------------------------------------------------------
  // BUILD GRID
  // ------------------------------------------------------------------------
  function buildGrid() {
    grid.innerHTML = "";

    for (let i = visibleRange[0]; i <= visibleRange[1]; i++) {
      const block = document.createElement("div");
      block.classList.add("block");
      block.textContent = i;

      if (i === founderBlock) {
        block.classList.add("founder");
        block.style.border = "2px solid gold";
        block.style.cursor = "not-allowed";
      }
      if (claimedBlocks.includes(i)) {
        block.classList.add("claimed");
        block.style.cursor = "pointer";
      }

      grid.appendChild(block);
    }

    if (!document.getElementById("founders-message")) {
      const msg = document.createElement("p");
      msg.id = "founders-message";
      msg.style.textAlign = "center";
      msg.style.color = "#d4af37";
      msg.style.marginTop = "1rem";
      msg.style.fontWeight = "600";
      msg.textContent = `Showing Founders Grid (Blocks ${visibleRange[0]}–${visibleRange[1]}).`;
      grid.insertAdjacentElement("afterend", msg);
    }
  }

  buildGrid();

  // ------------------------------------------------------------------------
  // UPDATE GRID CLAIMED STATE
  // ------------------------------------------------------------------------
  function applyClaimedStylingToGrid() {
    document.querySelectorAll(".block").forEach((block) => {
      const num = Number(block.textContent);
      if (num === founderBlock) return;

      if (claimedBlocks.includes(num)) {
        block.classList.add("claimed");
        block.classList.remove("selected");
        block.style.cursor = "pointer";
      }
    });
  }

  // ------------------------------------------------------------------------
  // VIEW MODAL LOGIC
  // ------------------------------------------------------------------------
  function openViewModal(blockNumber) {
    const data = blockDataMap[blockNumber] || {};

    if (!viewModal || !viewModalContent) return;

    viewBlockTitle.textContent = `Block #${blockNumber}`;

    // Message
    const msg = (data.message || "").trim();
    viewBlockMessage.textContent = msg
      ? msg
      : "No message has been added to this block yet.";

    // Meta
    let owner = data.name || "Anonymous";
    let dateText = "Date unknown";
    if (data.purchasedAt && typeof data.purchasedAt.toDate === "function") {
      dateText = data.purchasedAt.toDate().toLocaleString();
    }
    viewBlockMeta.textContent = `By ${owner} • Claimed on ${dateText}`;

    // Media
    viewBlockMedia.innerHTML = "";
    const url = data.mediaUrl;
    const type = data.mediaType;

    if (!url) {
      const p = document.createElement("p");
      p.textContent = "This block has no media file attached.";
      viewBlockMedia.appendChild(p);
    } else if (type === "image") {
      const img = document.createElement("img");
      img.src = url;
      img.alt = data.originalFileName || `Block ${blockNumber} image`;
      viewBlockMedia.appendChild(img);
    } else if (type === "audio") {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = url;
      viewBlockMedia.appendChild(audio);
    } else if (type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.src = url;
      video.style.maxHeight = "300px";
      viewBlockMedia.appendChild(video);
    } else if (type === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.id = "viewBlockPDF";
      iframe.src = url;
      iframe.setAttribute("title", `Block ${blockNumber} PDF`);
      viewBlockMedia.appendChild(iframe);
    } else if (type === "text") {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.textContent = "Open text file in a new tab";
      viewBlockMedia.appendChild(link);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.textContent = "Open attached file";
      viewBlockMedia.appendChild(link);
    }

    viewModal.classList.remove("hidden");
  }

  function closeViewModal() {
    if (!viewModal) return;
    viewModal.classList.add("hidden");
  }

  closeViewBtn?.addEventListener("click", closeViewModal);
  viewModal?.addEventListener("click", (e) => {
    if (e.target === viewModal) closeViewModal();
  });

  // ------------------------------------------------------------------------
  // BLOCK CLICK HANDLERS
  // ------------------------------------------------------------------------
  function attachBlockClickHandlers() {
    document.querySelectorAll(".block").forEach((block) => {
      block.addEventListener("click", () => {
        const blockNumber = Number(block.textContent);
        if (!blockNumber) return;

        // Founder behavior: view only if we decide to use it; for now: no action
        if (blockNumber === founderBlock) return;

        // If claimed -> open view modal
        if (claimedBlocks.includes(blockNumber)) {
          openViewModal(blockNumber);
          return;
        }

        // If unclaimed -> open purchase modal
        document
          .querySelectorAll(".block")
          .forEach((b) => b.classList.remove("selected"));
        block.classList.add("selected");

        selectedBlockNumber = blockNumber;
        modal.classList.remove("hidden");
        document.getElementById("blockNumber").value = blockNumber;
        document.getElementById("selected-block-text").textContent =
          `Selected Block: #${blockNumber}`;
      });
    });
  }

  attachBlockClickHandlers();

  // ------------------------------------------------------------------------
  // FETCH LATEST FROM FIRESTORE
  // ------------------------------------------------------------------------
  await loadClaimedBlocksFromFirestore();
  applyClaimedStylingToGrid();
  hideLoadingOverlay();

  // ========================================================================
  // MODAL CLOSE (BUY MODAL)
  // ========================================================================
  closeButton?.addEventListener("click", () => modal.classList.add("hidden"));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // ========================================================================
  // PAYPAL + VALIDATION (single render)
  // ========================================================================
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  let paypalRendered = false;

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
    if (f.size > 2 * 1024 * 1024) {
      alert("❌ Your file is larger than 2MB.");
      document.getElementById("fileUpload").value = "";
      return false;
    }
    return true;
  }

  function updateGate() {
    if (!validateFileSize()) {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
      return;
    }

    if (canCheckout()) {
      readyMsg.classList.add("show");

      if (!paypalRendered) {
        paypalRendered = true;
        renderPayPalButton();
      }

      paypalContainer.classList.add("show");
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  saveBtn?.addEventListener("click", updateGate);
  form?.addEventListener("input", updateGate, true);
  form?.addEventListener("change", updateGate, true);

  // ========================================================================
  // PAYPAL BUTTON – SINGLE RENDER ONLY
  // ========================================================================
  function renderPayPalButton() {
    paypalContainer.innerHTML = "";

    paypal.Buttons({
      style: { color: "gold", shape: "pill", label: "pay", height: 45 },

      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [
            {
              description: `Vault of Time Block #${selectedBlockNumber}`,
              amount: { value: blockPrice.toFixed(2) }
            }
          ]
        });
      },

      onApprove: async (data, actions) => {
        const details = await actions.order.capture();
        alert(`✅ Payment completed by ${details.payer.name.given_name}.`);

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();
        const fileInput = document.getElementById("fileUpload");
        const file = fileInput.files[0];

        // Upload file to Storage
        const { url, mediaType } = await uploadFileForBlock(
          selectedBlockNumber,
          file
        );

        // Save metadata in Firestore
        await saveBlockToFirestore(selectedBlockNumber, {
          name,
          email,
          message,
          mediaUrl: url,
          mediaType,
          originalFileName: file?.name || null
        });

        // Update local caches
        if (!claimedBlocks.includes(selectedBlockNumber)) {
          claimedBlocks.push(selectedBlockNumber);
        }

        blockDataMap[selectedBlockNumber] = {
          blockNumber: selectedBlockNumber,
          name,
          email,
          message,
          mediaUrl: url,
          mediaType,
          originalFileName: file?.name || null,
          // purchasedAt will be serverTimestamp; viewer will handle it when reloaded
        };

        localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        applyClaimedStylingToGrid();

        modal.classList.add("hidden");

        // Optionally: auto-open the viewer after purchase
        openViewModal(selectedBlockNumber);
      },

      onCancel: () => alert("❌ Transaction cancelled."),
      onError: (err) => {
        console.error(err);
        alert("Payment error.");
      }
    }).render("#paypal-button-container");
  }

  // ========================================================================
  // MENU
  // ========================================================================
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  menuToggle?.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  });

  closeMenu?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });

  overlay?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });

  // ========================================================================
  // ACCORDION
  // ========================================================================
  function initAccordion() {
    document.querySelectorAll(".accordion-header").forEach((header) => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const open = content.classList.contains("show");

        document.querySelectorAll(".accordion-content").forEach((c) =>
          c.classList.remove("show")
        );
        document.querySelectorAll(".accordion-header").forEach((h) =>
          h.classList.remove("active")
        );

        if (!open) {
          content.classList.add("show");
          header.classList.add("active");
        }
      };
    });
  }
  setTimeout(initAccordion, 200);
});
