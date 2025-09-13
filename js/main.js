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



// project.js
$(document).ready(function() {
  // Initialize accordion
  $("#effects-accordion").accordion({
    collapsible: true,
    heightStyle: "content",
    active: false
  });

  // Effect 1: Fade In / Fade Out
  $("#fadeBtn").click(function() {
    $("#fadeBox").fadeToggle("slow");
  });

  // Effect 2: Slide Toggle
  $("#slideBtn").click(function() {
    $("#slideBox").slideToggle("slow");
  });

  // Effect 3: Animate
  $("#animateBtn").click(function() {
    $("#animateBox").animate({
      left: '+=50px',
      width: '150px',
      height: '150px'
    }, 1000);
  });

  // Effect 4: Hide / Show
  $("#toggleVisibilityBtn").click(function() {
    $("#toggleBox").toggle("fast");
  });

  // Effect 5: Custom Placeholder
  $("#customBtn").click(function() {
    $("#customBox").css("background", "gold").fadeOut(500).fadeIn(500);
  });
});