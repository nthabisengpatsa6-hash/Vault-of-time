document.addEventListener("DOMContentLoaded", function () {
  // === GRID LOGIC ===
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");

  // === SETTINGS ===
  const totalBlocks = 1000;
  const visibleRange = [1, 100]; // Founders Drop
  const founderBlock = 1;

  // === LOAD CLAIMED BLOCKS (localStorage for now) ===
  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // === GRID GENERATION ===
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

  // === DROP MESSAGE ===
  const message = document.createElement("p");
  message.style.textAlign = "center";
  message.style.color = "#d4af37";
  message.style.marginTop = "1rem";
  message.style.fontWeight = "600";
  message.textContent = `Showing Founders Drop (Blocks ${visibleRange[0]}–${visibleRange[1]}). The next drop unlocks after ${visibleRange[1]} blocks are sealed.`;
  grid.insertAdjacentElement("afterend", message);

  const allBlocks = document.querySelectorAll(".block");

  // === CLICK HANDLER ===
  allBlocks.forEach((block, index) => {
    const blockNumber = index + visibleRange[0];
    if (claimedBlocks.includes(blockNumber) || blockNumber === founderBlock) return;

    block.addEventListener("click", () => handleClick(blockNumber, block));
  });

  function handleClick(blockNumber, blockElement) {
    allBlocks.forEach((b) => b.classList.remove("selected"));
    blockElement.classList.add("selected");
    modal.classList.remove("hidden");

    const form = document.getElementById("blockForm");
    if (form) {
      form.onsubmit = () => {
        if (!claimedBlocks.includes(blockNumber)) {
          claimedBlocks.push(blockNumber);
          localStorage.setItem("claimedBlocks", JSON.stringify(claimedBlocks));
        }
      };
    }
  }

  // === CLOSE MODAL ===
  closeButton.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // === SIDE MENU LOGIC ===
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  // Open menu
  menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
    menuToggle.classList.add("active");

    // Optional: auto-expand the first accordion (About)
    const firstHeader = document.querySelector(".accordion-header");
    if (firstHeader && !firstHeader.classList.contains("active")) {
      firstHeader.click();
    }
  });

  // Close menu
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

  // === ACCORDION LOGIC ===
  const accordionHeaders = document.querySelectorAll(".accordion-header");

  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = content.classList.contains("show");

      // Close all
      document.querySelectorAll(".accordion-content").forEach((c) => c.classList.remove("show"));
      document.querySelectorAll(".accordion-header").forEach((h) => h.classList.remove("active"));

      // Open clicked
      if (!isOpen) {
        content.classList.add("show");
        header.classList.add("active");

        // Smooth scroll to bring it into view
        setTimeout(() => {
          header.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    });
  });

  console.log("Vault of Time script loaded ✅");
});
