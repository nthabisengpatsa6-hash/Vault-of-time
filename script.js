// Modal Logic
const modal = document.getElementById('modal');
console.log("Modal element is:", modal);
const closeButton = document.querySelector('.close');

// Show modal when a block is clicked
function handleClick(index, blockElement) {
  // Log the block number
  console.log('Block clicked:', index + 1);

  // Highlight the clicked block
  const allBlocks = document.querySelectorAll('.block');
  allBlocks.forEach(b => b.classList.remove('selected'));
  blockElement.classList.add('selected');

  // Show the modal
  modal.classList.remove('hidden');
}
// Close modal when the close button is clicked
closeButton.addEventListener('click', () => {
  modal.classList.add('hidden');
});
