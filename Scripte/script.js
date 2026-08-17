/* global $, document, window */

$(document).ready(function () {
  "use strict";

  (function splitLogo() {
    var $a = $(".navbar .logo a");
    if (!$a.length || $a.data("split")) return;
    $a.data("split", true);
    var text = $a.text();
    var baseDelay = 0.3,
      step = 0.04,
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

  if (window.innerWidth < 947) {
    $(".has-col1").removeClass("col-1");
    $(".has-col4").removeClass("col-4");
    $(".has-col5").removeClass("col-5");
    $(".has-col6").removeClass("col-6");
    $(".has-col7").removeClass("col-7");
    $(".img-wrap").removeClass("img-wrap");
  } else {
    $(".has-col1").addClass("col-1");
    $(".has-col4").addClass("col-4");
    $(".has-col5").addClass("col-5");
    $(".has-col6").addClass("col-6");
    $(".has-col7").addClass("col-7");
    $(".img-wrap").addClass("img-wrap");
  }
  // bolding sections
  $(document).on("scroll", function () {
    var scrollTop = $(this).scrollTop();
    var $works = $("#works");
    var $about = $("#about");
    var $contact = $("#contact");
    var $links = $("a.menu-btn");

    if ($works.length && $about.length) {
      if (
        scrollTop >= $works.position().top &&
        scrollTop < $about.position().top - 190
      ) {
        $links.addClass("works-active");
      } else {
        $links.removeClass("works-active");
      }
    }

    if ($about.length && $contact.length) {
      if (
        scrollTop >= $about.position().top - 190 &&
        scrollTop < $contact.position().top - 130
      ) {
        $links.addClass("about-active");
      } else {
        $links.removeClass("about-active");
      }
    }

    if ($contact.length) {
      var nearBottom =
        scrollTop + $(window).height() >= $(document).height() - 100;
      if (scrollTop >= $contact.position().top - 130 || nearBottom) {
        $links.addClass("contact-active");
        $("footer").addClass("sticky");
        $(".scroll-up-btn").addClass("show");
      } else {
        $links.removeClass("contact-active");
        $("footer").removeClass("sticky");
        $(".scroll-up-btn").removeClass("show");
      }
    }
  });
  $(window).scroll(function () {
    // sticky navbar on scroll script
    if (this.scrollY > 20) {
      $(".navbar").addClass("sticky");
    } else {
      $(".navbar").removeClass("sticky");
    }
  });

  // slide-up script
  $(".scroll-up-btn").click(function () {
    $("html").animate({ scrollTop: 0 });
    $("html").css("scrollBehavior", "auto");
  });

  $(".navbar .menu li a").click(function () {
    $("html").css("scrollBehavior", "smooth");
  });

  var $contactPicture = $(".contact-picture");
  if ($contactPicture.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var $el = $(entry.target);
          if (entry.isIntersecting) {
            $el.removeClass("in-view");
            void entry.target.offsetWidth;
            $el.addClass("in-view");
          } else {
            $el.removeClass("in-view");
          }
        });
      },
      { threshold: 0.2 },
    );
    observer.observe($contactPicture[0]);
  }

  // toggle menu/navbar script
  $(".menu-btn").click(function () {
    $(".navbar .menu").toggleClass("active");
    $(".material-symbols-outlined span").toggleClass("active");
    if ($(".menu").hasClass("active")) {
      $(".scroll-up-btn").removeClass("show");
    }
  });
});
