//main.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('nav ul.menu a').forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault(); // Stop browser from loading about.html

      const pageName = this.getAttribute('data-page');

      // Update the URL without showing the filename
      window.history.pushState({}, "", "/" + pageName);

      // OPTIONAL: Load new content dynamically
      document.getElementById("content").innerHTML = `
        <h2>${pageName} Page</h2>
        <p>Content for ${pageName} goes here.</p>
      `;
    });
  });
});