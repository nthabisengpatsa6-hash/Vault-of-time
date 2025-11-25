// === CONFIG ===
// This is the correct answer to enter the Vault
const correctAnswer = "memory";

// Animation helpers
function shake(element) {
  element.classList.add("shake");
  setTimeout(() => element.classList.remove("shake"), 500);
}

// === CONFIG ===
// This is the correct answer to enter the Vault
const correctAnswer = "memory";

// Animation helpers
function shake(element) {
  element.classList.add("shake");
  setTimeout(() => element.classList.remove("shake"), 500);
}

function successEffect(container, input) {
  container.classList.add("success");
  input.classList.add("success-flash");

  setTimeout(() => input.classList.remove("success-flash"), 800);
  setTimeout(() => container.classList.remove("success"), 1000);
}

// === MAIN LOGIC ===
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("vaultAnswer");
  const btn = document.getElementById("submitVaultAnswer");
  const container = document.querySelector(".gate-container");
  const doors = document.getElementById("vault-doors");

  btn.addEventListener("click", () => {
    const userValue = input.value.trim().toLowerCase();

    if (userValue === correctAnswer.toLowerCase()) {
      // Success animations
      successEffect(container, input);

      // Show doors overlay
      doors.classList.remove("doors-hidden");

      // Trigger opening after a tiny delay
      setTimeout(() => {
        doors.classList.add("doors-open");
      }, 100);

      // Redirect after doors finish opening
      setTimeout(() => {
        window.location.href = "vault.html";
      }, 1800);

    } else {
      shake(container);
      input.value = "";
    }
  });

  // Allow pressing Enter to submit
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      btn.click();
    }
  });
});

// === MAIN LOGIC ===
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("vaultAnswer");
  const btn = document.getElementById("submitVaultAnswer");
  const container = document.querySelector(".gate-container");

  btn.addEventListener("click", () => {
    const userValue = input.value.trim().toLowerCase();

    if (userValue === correctAnswer.toLowerCase()) {
      // Success animations
      successEffect(container, input);

      // Redirect after a tiny pause
      setTimeout(() => {
        window.location.href = "vault.html";
      }, 1200);

    } else {
      shake(container);
      input.value = "";
    }
  });

  // Allow pressing Enter to submit
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      btn.click();
    }
  });
});