// === VAULT OF TIME INTERACTIVE SCRIPT ===
document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");

  // === Generate Blocks ===
  for (let i = 1; i <= 100; i++) {
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;
    grid.appendChild(block);
  }

  const allBlocks = document.querySelectorAll(".block");

  // === Mark Claimed Blocks (demo) ===
  const claimedBlocks = [3, 7, 15, 21];
  claimedBlocks.forEach((id) => {
    if (allBlocks[id - 1]) {
      allBlocks[id - 1].classList.add("claimed");
      allBlocks[id - 1].style.cursor = "not-allowed";
    }
  });

  // === Open Modal on Available Block Click ===
  allBlocks.forEach((block, index) => {
    if (!block.classList.contains("claimed")) {
      block.addEventListener("click", () => handleClick(index, block));
    }
  });

  function handleClick(index, blockElement) {
    allBlocks.forEach((b) => b.classList.remove("selected"));
    blockElement.classList.add("selected");
    modal.classList.remove("hidden");
  }

  // === Close Modal ===
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }
});

