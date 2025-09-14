// main.js

// about page accordion
$(document).ready(function() {
  $(".accordion-header").click(function() {
    // Close any open content except the one clicked
    $(".accordion-content").not($(this).next()).slideUp();

    // Toggle the clicked content
    $(this).next().slideToggle();
  });
});

$(document).ready(function() {
  $('nav ul.menu li a').each(function() {
    if(this.href === window.location.href) {
      $(this).addClass('active');
    }
  });
});


// project.js
$(document).ready(function() {
  // Initialize accordion
  $("#effects-accordion").accordion({
  collapsible: true,
  heightStyle: "content",
  active: false,
  header: "h3",       // Ensure it targets your headers
  animate: 200
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

  // Effect 5: Bounce & Color Cycle
  $("#bounceColorBtn").click(function() {
    let box = $("#bounceColorBox");

    // Bounce animation
    box.animate({ top: "-30px" }, 300)
       .animate({ top: "0px" }, 300)
       .animate({ top: "-20px" }, 200)
       .animate({ top: "0px" }, 200)
       .animate({ top: "-10px" }, 150)
       .animate({ top: "0px" }, 150);

    // Color cycle sequence
    setTimeout(() => box.css("background", "#ff006e"), 200);  // Bright pink
    setTimeout(() => box.css("background", "#3a86ff"), 600);  // Blue
    setTimeout(() => box.css("background", "#0ce8b5"), 1000); // Teal
    setTimeout(() => box.css("background", "#8338ec"), 1400); // Back to original purple
  });
});