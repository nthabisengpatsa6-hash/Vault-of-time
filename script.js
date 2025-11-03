document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById('modal');
  console.log("Modal element is:", modal);
  const closeButton = document.querySelector('.close-button');

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
