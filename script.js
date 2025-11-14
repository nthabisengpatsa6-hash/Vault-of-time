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

  grid.innerHTML = "";

  // Generate grid blocks
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

  // === BLOCK CLICK ===
  document.querySelectorAll(".block").forEach((block, index) => {
    const blockNumber = index + visibleRange[0];
    if (claimedBlocks.includes(blockNumber) || blockNumber === founderBlock) return;

    block.addEventListener("click", () => {
      document.querySelectorAll(".block").forEach((b) => b.classList.remove("selected"));
      block.classList.add("selected");
      selectedBlockNumber = blockNumber;
      modal.classList.remove("hidden");
      console.log(`Clicked block ${blockNumber}`);
      document.getElementById("blockNumber").value = selectedBlockNumber;
      document.getElementById("selected-block-text").textContent = `Selected Block: #${selectedBlockNumber}`;
    });
  });

  // === MODAL CLOSE ===
  if (closeButton) {
    closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  // === PAYPAL LOGIC ===
  const saveBtn = document.getElementById("uploadBtn");
  const readyMsg = document.getElementById("ready-message");
  const paypalContainer = document.getElementById("paypal-button-container");

  function canCheckout() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const file = document.getElementById("fileUpload").files.length > 0;
    return name && email && file && selectedBlockNumber;
  }

  function updateGate() {
    if (canCheckout()) {
      readyMsg.classList.add("show");
      paypalContainer.classList.add("show");
      renderPayPalButton();
    } else {
      readyMsg.classList.remove("show");
      paypalContainer.classList.remove("show");
    }
  }

  // === Render PayPal Button ===
  function renderPayPalButton() {
    paypalContainer.innerHTML = ""; // prevent duplicates

    paypal.Buttons({
      style: { color: "gold", shape: "pill", label: "pay", height: 45 },
      createOrder: (data, actions) => {
        const label = selectedBlockNumber
          ? `Vault of Time Block #${selectedBlockNumber}`
          : "Vault of Time Block";
        return actions.order.create({
          purchase_units: [
            { description: label, amount: { value: blockPrice.toFixed(2) } }
          ]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then((details) => {
          alert(`✅ Payment completed by ${details.payer.name.given_name}.
Your Block #${selectedBlockNumber} is now reserved.`);

          claimedBlocks.push(selectedBlockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));

          const selectedBlock = document.querySelector(".block.selected");
          if (selectedBlock) {
            selectedBlock.classList.remove("selected");
            selectedBlock.classList.add("claimed");
            selectedBlock.style.cursor = "not-allowed";
          }

          modal.classList.add("hidden");

          // Generate certificate
          const name = document.getElementById("name").value.trim();
          generateCertificatePDF(name, selectedBlockNumber);
        });
      },
      onCancel: () => alert("❌ Transaction cancelled."),
      onError: (err) => {
        console.error(err);
        alert("Payment error. Please try again.");
      }
    }).render("#paypal-button-container");
  }

  // === EVENT LISTENERS ===
  ["input", "change"].forEach(evt => {
    document.getElementById("blockForm").addEventListener(evt, updateGate, true);
  });
  saveBtn.addEventListener("click", updateGate);

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
    if (!headers.length) return;

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
  }

  setTimeout(initAccordion, 300);

  // === PDF CERTIFICATE ===
  function generateCertificatePDF(name, blockNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(6);
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60);

    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.text("Vault Of Time Certificate of Ownership", pageWidth / 2, 120, { align: "center" });

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

    const today = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Issued on: ${today}`, pageWidth / 2, 360, { align: "center" });

    const logo = new Image();
    logo.src = "vault-logo.jpg";
    logo.onload = () => {
      const size = 200;
      doc.addImage(logo, "JPEG", pageWidth - size - 60, pageHeight - size - 60, size, size, "", "FAST");
      doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
    };
    logo.onerror = () => doc.save(`VaultOfTime_Certificate_Block${blockNumber}.pdf`);
  }

  // === NOTICE BANNER LOGIC ===
  const banner = document.getElementById("rulesBanner");
  const ackBtn = document.getElementById("ackRulesBtn");
  const openHowToBtn = document.getElementById("openHowTo");
  const openRulesBtn = document.getElementById("openRules");

  if (banner && !localStorage.getItem("vaultRulesAcknowledged")) {
    banner.classList.remove("hidden");
  }

  if (ackBtn) {
    ackBtn.addEventListener("click", () => {
      banner.classList.add("hidden");
      localStorage.setItem("vaultRulesAcknowledged", "true");
    });
  }

  function openAccordionByText(text) {
    document.querySelectorAll(".accordion-header").forEach(header => {
      if (header.textContent.includes(text)) {
        const content = header.nextElementSibling;
        content.classList.add("show");
        header.classList.add("active");
        sideMenu.classList.add("open");
        overlay.classList.add("show");
      }
    });
  }

  if (openHowToBtn) {
    openHowToBtn.addEventListener("click", () => openAccordionByText("How To Buy"));
  }

  if (openRulesBtn) {
    openRulesBtn.addEventListener("click", () => openAccordionByText("Vault Rules"));
  }
});
