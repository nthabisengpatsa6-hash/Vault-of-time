
function handleClick(index) {
  alert('You clicked block #' + (index + 1));
  console.log('Block clicked:', index + 1);
}
// Modal Logic
const modal = document.getElementById('modal');
const closeButton = document.querySelector('.close-button');

// Show modal when a block is clicked
function handleClick() {
  modal.classList.remove('hidden');
}

// Close modal when the close button is clicked
closeButton.addEventListener('click', () => {
  modal.classList.add('hidden');
});

// Optional: Close modal when clicking outside the content
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
  }
});
