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
  const blockPrice = 5.00; // USD price per block

  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  let selectedBlockNumber = null;

  // Generate blocks
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

  // === PAYPAL INTEGRATION ===
  let paypalContainer = null;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!selectedBlockNumber) {
      alert("Please select a block first.");
      return;
    }

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const file = document.getElementById("fileUpload").files[0];

    if (!name || !email || !file) {
      alert("Please complete all fields before checkout.");
      return;
    }

    // Create PayPal button container dynamically
    if (!paypalContainer) {
      paypalContainer = document.createElement("div");
      paypalContainer.id = "paypal-button-container";
      paypalContainer.style.marginTop = "15px";
      form.insertAdjacentElement("afterend", paypalContainer);
    }

    // Render PayPal button
    paypal.Buttons({
      createOrder: function (data, actions) {
        return actions.order.create({
          purchase_units: [{
            description: `Vault Of Time Block #${selectedBlockNumber}`,
            amount: { value: blockPrice.toFixed(2) }
          }]
        });
      },
      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          alert(`Payment successful! Block #${selectedBlockNumber} is now yours, ${details.payer.name.given_name}!`);

          // Mark block as claimed
          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

          const selectedBlock = document.querySelector(".block.selected");
          selectedBlock.classList.remove("selected");
          selectedBlock.classList.add("claimed");
          selectedBlock.style.cursor = "not-allowed";

          modal.classList.add("hidden");
        });
      },
      onError: function (err) {
        console.error(err);
        alert("Payment failed. Please try again.");
      }
    }).render("#paypal-button-container");
  });

  // === SIDE MENU ===
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
    menuToggle.classList.add("active");
  });

  closeMenu.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
    menuToggle.classList.remove("active");
  });

  overlay.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
    menuToggle.classList.remove("active");
  });

  // === ACCORDION ===
  const accordionHeaders = document.querySelectorAll(".accordion-header");
  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = content.classList.contains("show");

      document.querySelectorAll(".accordion-content").forEach((c) => c.classList.remove("show"));
      document.querySelectorAll(".accordion-header").forEach((h) => h.classList.remove("active"));

      if (!isOpen) {
        content.classList.add("show");
        header.classList.add("active");
        setTimeout(() => header.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      }
    });
  });
});
