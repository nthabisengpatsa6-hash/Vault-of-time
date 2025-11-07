document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");

  // Load claimed blocks from localStorage (personal persistence)
  const claimedBlocks = JSON.parse(localStorage.getItem("claimedBlocks")) || [];

  // Generate 100 blocks
  for (let i = 1; i <= 100; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;

    // === Founder’s Block ===
    if (i === 1) {
      block.classList.add("founder");
      block.title = "🔒 Reserved by The Vault of Time Founder";
      block.style.border = "2px solid gold";
      block.style.cursor = "not-allowed";
    }

    // === Personal Claimed Blocks ===
    if (claimedBlocks.includes(i)) {
      block.classList.add("claimed");
      block.style.cursor = "not-allowed";
    }

    grid.appendChild(block);
  }

  const allBlocks = document.querySelectorAll(".block");

  // Handle click for available blocks
  allBlocks.forEach((block, index) => {
    const blockNumber = index + 1;

    // Skip claimed or founder blocks
    if (claimedBlocks.includes(blockNumber) || blockNumber === 1) return;

    block.addEventListener("click", () => handleClick(blockNumber, block));
  });

  function handleClick(blockNumber, blockElement) {
    allBlocks.forEach((b) => b.classList.remove("selected"));
    blockElement.classList.add("selected");
    modal.classList.remove("hidden");

    // Save claimed block on form submit
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

  // Close modal
  closeButton.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
});

