// ========= CONFIG =========
const blockPrice = 6.00; // USD
const sandboxMode = true;

// SANDBOX CLIENT
const PAYPAL_CLIENT_ID = sandboxMode
  ? "sb" // sandbox
  : "AUK2McH5yTvRCHXypQrwShFriZMsW7Ojf16wtlHAYP8rsK92eio4l65xyVDfC0sZl2WGQWTlFrbZZnP7";

// ========= DOM HOOKS =========
const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const closeBtn = document.querySelector(".close-button");

const fileUpload = document.getElementById("fileUpload");
const messageInput = document.getElementById("message");
const uploadBtn = document.getElementById("uploadBtn");

const paypalButtonContainer = document.getElementById("paypal-button-container");
const readyMessage = document.getElementById("ready-message");

const viewModal = document.getElementById("viewModal");
const viewBlockMedia = document.getElementById("viewBlockMedia");
const viewBlockMessage = document.getElementById("viewBlockMessage");
const viewBlockTitle = document.getElementById("viewBlockTitle");
const viewBlockMeta = document.getElementById("viewBlockMeta");

let selectedBlockNumber = null;
let blockData = {}; // Local store until backend is added
let paypalButtonsInstance = null;


// ========= BUILD GRID =========
function buildGrid() {
  for (let i = 1; i <= 2000; i++) {
    const block = document.createElement("div");
    block.className = "block";
    block.textContent = i;

    block.addEventListener("click", () => handleBlockClick(i));
    grid.appendChild(block);
  }
}

buildGrid();


// ========= BLOCK CLICK =========
function handleBlockClick(blockNum) {
  const block = getBlock(blockNum);

  if (block.claimed) {
    openViewModal(blockNum);
  } else {
    openBuyModal(blockNum);
  }
}


// ========= BUY MODAL =========
function openBuyModal(num) {
  selectedBlockNumber = num;
  document.getElementById("selected-block-text").textContent =
    `You're claiming Block #${num}`;
  document.getElementById("blockNumber").value = num;

  modal.classList.remove("hidden");
  readyMessage.classList.remove("show");
  paypalButtonContainer.classList.remove("show");
}

closeBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});


// ========= SIDE STORE =========
function getBlock(num) {
  if (!blockData[num]) {
    blockData[num] = { claimed: false };
  }
  return blockData[num];
}

function saveBlock(num, fileUrl, message, name, email) {
  blockData[num] = {
    claimed: true,
    fileUrl,
    message,
    name,
    email,
    timestamp: new Date().toISOString(),
  };

  refreshGrid();
}

function refreshGrid() {
  [...grid.children].forEach((block) => {
    const id = Number(block.textContent);
    if (blockData[id]?.claimed) {
      block.classList.add("claimed");
    }
  });
}


// ========= UPLOAD HANDLER =========
uploadBtn.addEventListener("click", () => {
  if (!fileUpload.files.length) {
    alert("Please upload a file first.");
    return;
  }

  readyMessage.classList.add("show");
  paypalButtonContainer.classList.add("show");

  initPayPalButton();
});


// ========= PAYPAL BUTTON (REDIRECT VERSION) =========
function initPayPalButton() {
  paypalButtonContainer.innerHTML = ""; // reset

  paypalButtonsInstance = paypal.Buttons({
    createOrder(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: blockPrice.toFixed(2) },
          description: `Vault Block #${selectedBlockNumber}`
        }]
      });
    },

    async onApprove(data, actions) {
      const order = await actions.order.capture();
      await handleSuccessfulPayment(order);
    },

    onError(err) {
      console.error("PayPal error:", err);
      alert("There was an issue with PayPal. Please try again.");
    }
  });

  paypalButtonsInstance.render("#paypal-button-container");
}


// ========= PAYMENT SUCCESS =========
async function handleSuccessfulPayment(orderDetails) {
  const file = fileUpload.files[0];

  // Fake URL until backend exists
  const fileUrl = URL.createObjectURL(file);

  const message = messageInput.value || "";
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;

  saveBlock(selectedBlockNumber, fileUrl, message, name, email);

  modal.classList.add("hidden");
  alert("Your block has been added. Refresh to view it!");

  fileUpload.value = "";
  messageInput.value = "";
}


// ========= VIEW MODAL =========
function openViewModal(blockNum) {
  const block = getBlock(blockNum);

  viewBlockTitle.textContent = `Block #${blockNum}`;

  viewBlockMessage.textContent = block.message || "";
  viewBlockMeta.textContent = `Uploaded by ${block.name}`;

  viewBlockMedia.innerHTML = "";

  if (block.fileUrl.endsWith(".mp3")) {
    viewBlockMedia.innerHTML = `<audio controls src="${block.fileUrl}"></audio>`;
  } else if (block.fileUrl.endsWith(".mp4")) {
    viewBlockMedia.innerHTML = `<video controls src="${block.fileUrl}"></video>`;
  } else if (block.fileUrl.endsWith(".pdf")) {
    viewBlockMedia.innerHTML = `<iframe id="viewBlockPDF" src="${block.fileUrl}"></iframe>`;
  } else {
    viewBlockMedia.innerHTML = `<img src="${block.fileUrl}" />`;
  }

  viewModal.classList.remove("hidden");
}

document.querySelector(".close-view").addEventListener("click", () => {
  viewModal.classList.add("hidden");
});


// ========= ACCORDION FIX =========
document.querySelectorAll(".accordion-header").forEach((header) => {
  header.addEventListener("click", () => {
    const content = header.nextElementSibling;
    const isOpen = content.classList.contains("show");

    document.querySelectorAll(".accordion-content").forEach((c) => {
      c.classList.remove("show");
    });
    document.querySelectorAll(".accordion-header").forEach((h) => {
      h.classList.remove("active");
    });

    if (!isOpen) {
      header.classList.add("active");
      content.classList.add("show");
    }
  });
});


// ========= MENU =========
const menuToggle = document.getElementById("menuToggle");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const closeMenu = document.getElementById("closeMenu");

function openMenu() {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
  menuToggle.classList.add("active");
}

function closeMenuFn() {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
  menuToggle.classList.remove("active");
}

menuToggle.addEventListener("click", openMenu);
overlay.addEventListener("click", closeMenuFn);
closeMenu.addEventListener("click", closeMenuFn);
