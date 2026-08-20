/* global $, document, window */

$(document).ready(function () {
  "use strict";

  (function splitLogo() {
    var $a = $(".navbar .logo a");
    if (!$a.length || $a.data("split")) return;
    $a.data("split", true);
    var text = $a.text();
    var baseDelay = 0.3,
      step = 0.02,
      charIndex = 0,
      html = "";
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === " ") {
        html += "&nbsp;";
      } else {
        var delay = (baseDelay + charIndex * step).toFixed(3);
        html +=
          '<span class="anim-char" style="transition-delay:' +
          delay +
          's">' +
          c +
          "</span>";
        charIndex++;
      }
    }
    $a.html(html);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $(".navbar .logo").addClass("splitted");
      });
    });
  })();

  var $project = $("section.project");

  $(window).scroll(function () {
    if (this.scrollY > 20) {
      $(".navbar").addClass("sticky");
    } else {
      $(".navbar").removeClass("sticky");
    }

    var threshold = $project.length
      ? $project.offset().top + $project.outerHeight()
      : 500;
    if (this.scrollY > threshold) {
      $(".scroll-up-btn").addClass("show");
    } else {
      $(".scroll-up-btn").removeClass("show");
    }
  });

  $(".scroll-up-btn").click(function () {
    $("html").animate({ scrollTop: 0 });
    $("html").css("scrollBehavior", "auto");
  });

  $(".navbar .menu li a").click(function () {
    $("html").css("scrollBehavior", "smooth");
  });

  $(".menu-btn").click(function () {
    $(".navbar .menu").toggleClass("active");
    $(".material-symbols-outlined span").toggleClass("active");
    if ($(".menu").hasClass("active")) {
      $(".scroll-up-btn").removeClass("show");
    }
  });
});
