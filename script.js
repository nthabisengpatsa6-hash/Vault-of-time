document.addEventListener("DOMContentLoaded", function () {
  console.log("Vault of Time script loaded ✅");

  // === GRID LOGIC ===
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  const totalBlocks = 1000;
  const visibleRange = [1, 100];
  const founderBlock = 1;
  const blockPrice = 5.00; // USD

  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  let selectedBlockNumber = null;

  // 🧹 Clear any previous grid (fix for duplication)
  grid.innerHTML = "";

  // Generate grid
  for (let i = visibleRange[0]; i <= visibleRange[1]; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;

    if (i === founderBlock) {
      block.classList.add("founder");
      block.title = "🔒 Reserved by The Vault of Time Founder";
      block.style.border = "2px solid gold";
      block.style.cursor = "not-allowed";
    }

    if (claimedBlocks.includes(i)) {
      block.classList.add("claimed");
      block.style.cursor = "not-allowed";
    }

    grid.appendChild(block);
  }

  // Message
  const message = document.createElement("p");
  message.style.textAlign = "center";
  message.style.color = "#d4af37";
  message.style.marginTop = "1rem";
  message.style.fontWeight = "600";
  message.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}). The next drop unlocks after ${visibleRange[1]} blocks are sealed.`;
  grid.insertAdjacentElement("afterend", message);

  const allBlocks = document.querySelectorAll(".block");
  allBlocks.forEach((block, index) => {
    const blockNumber = index + visibleRange[0];
    if (claimedBlocks.includes(blockNumber) || blockNumber === founderBlock) return;

    block.addEventListener("click", () => {
      allBlocks.forEach((b) => b.classList.remove("selected"));
      block.classList.add("selected");
      selectedBlockNumber = blockNumber;
      modal.classList.remove("hidden");
      console.log(`Clicked block ${blockNumber}`);
    });
  });

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  // === PAYPAL LOGIC ===
  let paypalContainer = null;
  const saveBtn = form.querySelector('button[type="submit"]');

  function checkFormReady() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const file = document.getElementById("fileUpload").files.length > 0;

    if (name && email && file) {
      saveBtn.textContent = "Proceed to PayPal 💳";
      saveBtn.style.backgroundColor = "#333";
      saveBtn.style.cursor = "not-allowed";
      saveBtn.disabled = true;
      showPayPalButton();
    }
  }

  function showPayPalButton() {
    if (!paypalContainer) {
      paypalContainer = document.createElement("div");
      paypalContainer.id = "paypal-button-container";
      paypalContainer.style.marginTop = "15px";
      paypalContainer.style.opacity = "0";
      paypalContainer.style.transition = "opacity 0.6s ease"; // ✨ smooth fade-in
      form.insertAdjacentElement("afterend", paypalContainer);
    }

    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            description: `Vault Of Time Block #${selectedBlockNumber}`,
            amount: { value: blockPrice.toFixed(2) }
          }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then((details) => {
          alert(`✅ Payment successful! Block #${selectedBlockNumber} is now yours, ${details.payer.name.given_name}.`);

          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

          const selectedBlock = document.querySelector(".block.selected");
          selectedBlock.classList.remove("selected");
          selectedBlock.classList.add("claimed");
          selectedBlock.style.cursor = "not-allowed";

          modal.classList.add("hidden");
        });
      },
      onError: (err) => {
        console.error(err);
        alert("Payment failed. Please try again.");
      }
    }).render("#paypal-button-container");
    document.dispatchEvent(new Event("paypalButtonsRendered"));

    // trigger the fade-in after rendering
    setTimeout(() => paypalContainer.style.opacity = "1", 200);
  }

  // Listen for input changes
  document.getElementById("name").addEventListener("input", checkFormReady);
  document.getElementById("email").addEventListener("input", checkFormReady);
  document.getElementById("fileUpload").addEventListener("change", checkFormReady);

// === ACCORDION (final fix) ===
function initAccordion() {
  const headers = document.querySelectorAll(".accordion-header");
  if (!headers.length) {
    console.warn("Accordion headers not found yet. Retrying...");
    setTimeout(initAccordion, 400);
    return;
  }

  headers.forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = content.classList.contains("show");

      // Close all open sections
      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));

      // Open this one
      if (!isOpen) {
        content.classList.add("show");
        header.classList.add("active");
      }
    });
  });

  console.log("Accordion initialized ✅");
}

// Initialize accordion safely after everything else
window.addEventListener("load", () => {
  setTimeout(initAccordion, 300);
});

// Re-initialize after PayPal buttons render
document.addEventListener("paypalButtonsRendered", () => {
  setTimeout(initAccordion, 300);
});
