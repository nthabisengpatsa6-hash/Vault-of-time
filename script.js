document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById('modal');
  console.log("Modal element is:", modal);
  const closeButton = document.querySelector('.close-button');
  const blocks = document.querySelectorAll('.block');
blocks.forEach((block, index) => {
  block.addEventListener('click', () => handleClick(index, block));
});

  function handleClick(index, blockElement) {
    console.log('Block clicked:', index + 1);

    const allBlocks = document.querySelectorAll('.block');
    allBlocks.forEach(b => b.classList.remove('selected'));
    blockElement.classList.add('selected');

    modal.classList.remove('hidden');
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Expose handleClick globally
  window.handleClick = handleClick;
});
// A list of block numbers that are already taken
const claimedBlocks = [25, 47, 82];

if (claimedBlocks.includes(blockNumber)) {
    block.classList.add("claimed");
}
