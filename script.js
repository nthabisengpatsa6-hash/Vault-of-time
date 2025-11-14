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
  const blockPrice = 6.00; // USD

  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];
  let selectedBlockNumber = null;

  // 🧹 Clear grid (prevent duplication)
  grid.innerHTML = "";

  // Generate blocks
  for (let i = visibleRange[0]; i <= visibleRange[1]; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;

    // Founder block
    if (i === founderBlock) {
      block.classList.add("founder");
      block.title = "🔒 Reserved by The Vault of Time Founder";
      block.style.border = "2px solid gold";
      block.style.cursor = "not-allowed";
    }

    // Claimed blocks
    if (claimedBlocks.includes(i)) {
      block.classList.add("claimed");
      block.style.cursor = "not-allowed";
    }

    grid.appendChild(block);
  }

  // Message below grid
  const message = document.createElement("p");
  message.style.textAlign = "center";
  message.style.color = "#d4af37";
  message.style.marginTop = "1rem";
  message.style.fontWeight = "600";
  message.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}). The next drop unlocks after ${visibleRange[1]} blocks are sealed.`;
  grid.insertAdjacentElement("afterend", message);

  // Handle block click
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

  // === MODAL CLOSE ===
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
  const saveBtn = document.getElementById("uploadBtn"); // fixed reference

  function checkFormReady() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const file = document.getElementById("fileUpload").files.length > 0;

    if (name && email && file) {
      if (saveBtn) {
        saveBtn.textContent = "Proceed to PayPal 💳";
        saveBtn.style.backgroundColor = "#333";
        saveBtn.style.cursor = "not-allowed";
        saveBtn.disabled = true;
      }
      showPayPalButton();
    }
  }

  function showPayPalButton() {
    if (!paypalContainer) {
      paypalContainer = document.createElement("div");
      paypalContainer.id = "paypal-button-container";
      paypalContainer.style.marginTop = "15px";
      paypalContainer.style.opacity = "0";
      paypalContainer.style.transition = "opacity 0.6s ease";
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
          if (selectedBlock) {
            selectedBlock.classList.remove("selected");
            selectedBlock.classList.add("claimed");
            selectedBlock.style.cursor = "not-allowed";
          }

          modal.classList.add("hidden");

          // Auto-generate certificate
          const name = document.getElementById("name").value.trim();
          generateCertificatePDF(name, selectedBlockNumber);
        });
      },
      onError: (err) => {
        console.error("PayPal Error:", err);
        alert("Payment failed. Please try again.");
      }
    }).render("#paypal-button-container");

    document.dispatchEvent(new Event("paypalButtonsRendered"));
    setTimeout(() => paypalContainer.style.opacity = "1", 200);
  }

  // === LISTENERS ===
  document.getElementById("name").addEventListener("input", checkFormReady);
  document.getElementById("email").addEventListener("input", checkFormReady);
  document.getElementById("fileUpload").addEventListener("change", checkFormReady);
  saveBtn.addEventListener("click", checkFormReady); // new line to trigger PayPal reveal

  // === MENU LOGIC ===
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  if (menuToggle && sideMenu && closeMenu && overlay) {
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
  }

  // === ACCORDION ===
  function initAccordion() {
    const headers = document.querySelectorAll(".accordion-header");
    if (!headers.length) {
      console.warn("Accordion headers not found yet. Retrying...");
      setTimeout(initAccordion, 400);
      return;
    }

    headers.forEach(header => {
      header.onclick = () => {
        const content = header.nextElementSibling;
        const isOpen = content.classList.contains("show");

        document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
        document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));

        if (!isOpen) {
          content.classList.add("show");
          header.classList.add("active");
        }
      };
    });

    console.log("Accordion initialized ✅");
  }

  window.addEventListener("load", () => setTimeout(initAccordion, 300));
  document.addEventListener("paypalButtonsRendered", () => setTimeout(initAccordion, 300));

  // === CERTIFICATE PDF GENERATOR ===
  function generateCertificatePDF(name, blockNumber) {
    if (!window.jspdf) {
      console.error("jsPDF not loaded yet");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Border
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(6);
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60);

    // Header
    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.text("Vault Of Time Certificate of Ownership", pageWidth / 2, 120, { align: "center" });

    // Body
    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("This certifies that", pageWidth / 2, 200, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(26);
    doc.text(name, pageWidth / 2, 240, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text(`is the rightful guardian of Block #${blockNumber}`, pageWidth / 2, 280, { align: "center" });
    doc.text("Sealed within The Vault until 2050.", pageWidth / 2, 310, { align: "center" });

    // Date
    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, pageWidth / 2, 360, { align: "center" });

    // Logo watermark
    const logo = new Image();
    logo.src = "vault-logo.jpg";
    logo.onload = () => {
      const size = 200;
      doc.addImage(logo, "JPEG", pageWidth - size - 60, pageHeight - size - 60, size, size, "", "FAST");
      doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
    };
    logo.onerror = () => {
      doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
    };
  }
});
