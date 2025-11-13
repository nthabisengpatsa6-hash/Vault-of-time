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

  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // Generate blocks
  for (let i = visibleRange[0]; i <= visibleRange[1]; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;

    // Founder’s reserved block
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

  // Drop message
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
      modal.classList.remove("hidden");
      console.log(`Clicked block ${blockNumber}`);
    });
  });

  // Close modal
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

  // Handle form submit
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const selectedBlock = document.querySelector(".block.selected");
      if (!selectedBlock) return alert("Please select a block first.");

      const blockNumber = parseInt(selectedBlock.textContent);
      if (!claimedBlocks.includes(blockNumber)) {
        claimedBlocks.push(blockNumber);
        localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        selectedBlock.classList.add("claimed");
      }

      alert(`Block ${blockNumber} claimed! 🕰️`);
      modal.classList.add("hidden");
    });
  }

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
