/**************************
 FIREBASE SETUP
**************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD43CHOaiXHp9D2xlcDbFMiMjkoKp4R8hM",
  authDomain: "vaultoftime.firebaseapp.com",
  databaseURL: "https://vaultoftime-default-rtdb.firebaseio.com",
  projectId: "vaultoftime",
  storageBucket: "vaultoftime.appspot.com",
  messagingSenderId: "507887381784",
  appId: "1:507887381784:web:3c469a8db8e32be8533bd9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);



/**************************
 GRID GENERATION
**************************/
const gridContainer = document.getElementById("grid");
const TOTAL_BLOCKS = 100; // You can increase later

for (let i = 1; i <= TOTAL_BLOCKS; i++) {
  const block = document.createElement("div");
  block.classList.add("grid-block");
  block.textContent = i;
  block.dataset.block = i;
  block.addEventListener("click", () => openModal(i));
  gridContainer.appendChild(block);
}



/**************************
 MODAL + UI ELEMENTS
**************************/
const modal = document.getElementById("modal");
const closeButton = document.querySelector(".close-button");
const blockNumInput = document.getElementById("blockNumber");
const blockText = document.getElementById("selected-block-text");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const uploadBtn = document.getElementById("uploadBtn");
const fileUpload = document.getElementById("fileUpload");
const messageBox = document.getElementById("messageBox"); // NEW

const paypalContainer = document.getElementById("paypal-button-container");
const readyMsg = document.getElementById("ready-message");


function openModal(blockNum) {
  modal.classList.remove("hidden");
  blockNumInput.value = blockNum;
  blockText.textContent = `Block #${blockNum}`;
}

closeButton.addEventListener("click", () => {
  modal.classList.add("hidden");
  resetPaymentState();
});


function resetPaymentState() {
  paypalContainer.innerHTML = "";
  paypalContainer.classList.remove("show");
  readyMsg.classList.remove("show");
}



/**************************
 SAVE FORM + TRIGGER PAYMENT
**************************/
uploadBtn.addEventListener("click", async () => {
  const block = blockNumInput.value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const messageText = messageBox.value.trim();
  const file = fileUpload.files[0];

  if (!name || !email || !file) {
    alert("Please enter name, email & upload a file.");
    return;
  }

  // Upload file
  const filePath = `blocks/${block}/${file.name}`;
  const fileRef = sRef(storage, filePath);

  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);

  readyMsg.classList.add("show");

  // Render PayPal payment UI
  renderPayPal(buttonsFor(block, name, email, downloadURL, messageText));
});


async function saveBlock(block, name, email, url, messageText) {
  await set(ref(db, "blocks/" + block), {
    name,
    email,
    url,
    message: messageText,
    timestamp: Date.now()
  });
}



/**************************
 PAYPAL BUTTON SYSTEM
**************************/
function renderPayPal(blockData) {
  const { block, name, email, downloadURL, messageText } = blockData;

  paypalContainer.innerHTML = ""; // clear old
  paypal.Buttons({
    style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },

    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: "6.00", currency_code: "USD" },
          description: `Vault Block #${block}`
        }]
      });
    },

    onApprove: async function (data, actions) {
      await actions.order.capture();

      await saveBlock(block, name, email, downloadURL, messageText);
      alert(`Success! Block #${block} is now yours!`);
      location.reload();
    }

  }).render("#paypal-button-container");

  // ADD CARD BUTTON
  const cardBtn = document.createElement("button");
  cardBtn.textContent = "Pay with Debit or Credit Card";
  cardBtn.style = `
    margin-top: 10px;
    background-color: #f9d26e;
    color: #111;
    padding: 10px 15px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
  `;

  cardBtn.onclick = async () => {
    const orderId = await createPayPalOrder(block, name, email, messageText);
    window.location.href = `https://www.paypal.com/checkoutnow?token=${orderId}`;
  };

  paypalContainer.appendChild(cardBtn);
  paypalContainer.classList.add("show");
}



/**************************
 SERVER ORDER CREATION
 (stub — replace once backend exists)
**************************/
async function createPayPalOrder(block, name, email, messageText) {
  const fakeOrderId = "REPLACE_WITH_SERVER_ORDER_ID";
  return fakeOrderId;
}



/**************************
 PUBLIC VIEW MODE
 Click block → show content
**************************/
document.querySelectorAll(".grid-block").forEach(block => {
  block.addEventListener("click", async () => {
    const blockNum = block.dataset.block;

    const snapshot = await get(child(ref(db), `blocks/${blockNum}`));

    if (!snapshot.exists()) {
      openModal(blockNum);
      return;
    }

    const data = snapshot.val();

    let html = `
      <h2>Block #${blockNum}</h2>
      <p><strong>${data.name}</strong></p>
      ${data.message ? `<p>${data.message}</p>` : ""}
      <br>
    `;

    if (data.url) {
      if (data.url.includes(".jpg") || data.url.includes(".png") || data.url.includes(".gif")) {
        html += `<img src="${data.url}" class="vault-img">`;
      } else {
        html += `<a href="${data.url}" target="_blank">View Uploaded File</a>`;
      }
    }

    document.querySelector(".modal-content").innerHTML = `
      <span class="close-button">&times;</span>
      ${html}
    `;

    modal.classList.remove("hidden");

    document.querySelector(".close-button").onclick = () => modal.classList.add("hidden");
  });
});
