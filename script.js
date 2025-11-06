document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById('modal');
  console.log("Modal element is:", modal);
  const closeButton = document.querySelector('.close-button');
  const blocks = document.querySelectorAll('.block');

  // Step 1: define claimed block IDs (for now, hardcoded)
  const claimedBlocks = [3, 7, 15, 21]; // example IDs — replace with real ones later

  // Step 2: loop through blocks
  blocks.forEach((block, index) => {
    const blockId = index + 1; // assuming your blocks are ordered sequentially

    // Mark claimed blocks visually
    if (claimedBlocks.includes(blockId)) {
      block.classList.add('claimed');
      block.style.cursor = 'not-allowed'; // prevent clicking visual cue
    } else {
      // Only attach click handler if it's not claimed
      block.addEventListener('click', () => handleClick(index, block));
    }
  });

  // Step 3: define click behavior for available blocks
  function handleClick(index, blockElement) {
    console.log('Block clicked:', index + 1);

    const allBlocks = document.querySelectorAll('.block');
    allBlocks.forEach(b => b.classList.remove('selected'));
    blockElement.classList.add('selected');

    modal.classList.remove('hidden');
  }

  // Step 4: close modal logic
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Optional: expose handleClick globally (if needed elsewhere)
  window.handleClick = handleClick;
});

// === VAULT OF TIME INTERACTIVE SCRIPT ===
document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");
  const form = document.getElementById("blockForm");

  // === 1. Generate Blocks Dynamically ===
  for (let i = 1; i <= 100; i++) { // change 100 to 1000 later
    const block = document.createElement("div");
    block.classList.add("block");
    block.textContent = i;
    grid.appendChild(block);
  }

  const allBlocks = document.querySelectorAll(".block");

  // === 2. Mark Claimed Blocks (temporary demo) ===
  const claimedBlocks = [3, 7, 15, 21];
  claimedBlocks.forEach((id) => {
    if (allBlocks[id - 1]) {
      allBlocks[id - 1].classList.add("claimed");
      allBlocks[id - 1].style.cursor = "not-allowed";
    }
  });

  // === 3. Click handler for available blocks ===
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

  // === 4. Close modal ===
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  // === 5. Placeholder form logic ===
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Uploads will open in December. Thank you for being early!");
    modal.classList.add("hidden");
    form.reset();
  });
});
