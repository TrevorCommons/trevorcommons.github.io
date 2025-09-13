//main.js


// about code
$(document).ready(function() {
  $(".accordion-header").click(function() {
    // Close any open content except the one clicked
    $(".accordion-content").not($(this).next()).slideUp();

    // Toggle the clicked content
    $(this).next().slideToggle();
  });
});
