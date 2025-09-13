//main.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('nav ul.menu a').forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault(); // Stop default behavior

      const pageName = this.getAttribute('data-page');

      // Use hash instead of pushState
      window.location.hash = pageName;

      document.getElementById("content").innerHTML = `
        <h2>${pageName} Page</h2>
        <p>Content for ${pageName} goes here.</p>
      `;
    });
  });
});