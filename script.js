document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("grid");
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".close-button");

  // === SETTINGS ===
  const totalBlocks = 1000;
  // Change this range when next drop opens
  const visibleRange = [1, 100]; // Drop 1: blocks 1–100
  const founderBlock = 1;

  // === Load claimed blocks (from localStorage for now) ===
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

    // Claimed blocks (persistent on your device)
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

    // Save claimed block when form submitted
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
});
// COUNTDOWN TIMER
const countdownDate = new Date("Dec 15, 2025 12:00:00").getTime(); // Change date/time here

const timerInterval = setInterval(function() {
  const now = new Date().getTime();
  const distance = countdownDate - now;

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  const timer = document.getElementById("timer");
  if (distance > 0) {
    timer.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else {
    clearInterval(timerInterval);
    timer.innerHTML = "🎉 The Founders Drop is LIVE!";
  }
}, 1000);
