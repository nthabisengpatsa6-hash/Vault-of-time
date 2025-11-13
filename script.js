document.addEventListener("DOMContentLoaded", () => {
  // === GRID ===
  const grid = document.getElementById("grid");
  const totalBlocks = 100;
  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  for (let i = 1; i <= totalBlocks; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;
    if (claimedBlocks.includes(i)) block.classList.add("claimed");
    grid.appendChild(block);
  }

  // === SIDE MENU ===
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const closeMenu = document.getElementById("closeMenu");
  const overlay = document.getElementById("overlay");

  if (menuToggle && sideMenu && overlay && closeMenu) {
    const openMenu = () => {
      sideMenu.classList.add("open");
      overlay.classList.add("show");
      menuToggle.classList.add("active");

      // auto-expand first accordion
      const firstHeader = document.querySelector(".accordion-header");
      if (firstHeader && !firstHeader.classList.contains("active")) {
        firstHeader.click();
      }
    };

    const closeSideMenu = () => {
      sideMenu.classList.remove("open");
      overlay.classList.remove("show");
      menuToggle.classList.remove("active");
    };

    menuToggle.addEventListener("click", openMenu);
    closeMenu.addEventListener("click", closeSideMenu);
    overlay.addEventListener("click", closeSideMenu);
  }

  // === ACCORDION ===
  const accordionHeaders = document.querySelectorAll(".accordion-header");
  accordionHeaders.forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isOpen = content.classList.contains("show");

      document.querySelectorAll(".accordion-content").forEach(c => c.classList.remove("show"));
      document.querySelectorAll(".accordion-header").forEach(h => h.classList.remove("active"));

      if (!isOpen) {
        content.classList.add("show");
        header.classList.add("active");
        setTimeout(() => header.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      }
    });
  });

  console.log("Vault of Time ready ✅");
});
