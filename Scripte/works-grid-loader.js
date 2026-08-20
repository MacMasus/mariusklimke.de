/* global $, document, window */

$(document).ready(function () {
  "use strict";

  var placeholder = document.getElementById("works-grid");
  if (!placeholder) return;

  $.get("/shared/works-grid.html", function (html) {
    placeholder.innerHTML = html;

    // mobile-only project reordering (<500px). Masonry positions items
    // absolutely by DOM order, so CSS `order` can't reorder them — we move
    // the nodes before init. Desktop keeps the works-grid.html source order.
    if (window.innerWidth < 500) {
      var mGrid = placeholder.querySelector(".grid");

      // find a .grid-item by its project link
      var gridItem = function (href) {
        var link = mGrid.querySelector('.grid-item a[href="' + href + '"]');
        return link ? link.closest(".grid-item") : null;
      };
      // swap two grid-items in place, regardless of their positions
      var swapItems = function (a, b) {
        if (!a || !b) return;
        var marker = document.createComment("");
        a.before(marker);
        b.before(a);
        marker.replaceWith(b);
      };

      swapItems(gridItem("/puncher"), gridItem("/billennium"));

      // put woom above randoms
      var randoms = gridItem("/randoms");
      var woom = gridItem("/woom");
      if (randoms && woom) randoms.before(woom);

      // move tinka under kadys
      var kadys = gridItem("/kadys");
      var tinka = gridItem("/tinka");
      if (kadys && tinka) kadys.after(tinka);

      // move "(Public) Relations" (/conscious) to just below /valerio
      var valerio = gridItem("/valerio");
      var conscious = gridItem("/conscious");
      if (valerio && conscious) valerio.after(conscious);
    }

    // init Masonry
    var $grid = $(".grid").masonry({
      itemSelector: ".grid-item",
      columnWidth: ".grid-sizer",
      percentPosition: true,
      gutter: 20,
      stamp: ".stamp",
    });
    $grid
      .imagesLoaded()
      .progress(function () {
        $grid.masonry("layout");
      })
      .always(function () {
        // Re-scroll to hash target after layout settles, since the
        // grid is loaded async and shifts the page height.
        if (window.location.hash) {
          var target = document.getElementById(window.location.hash.slice(1));
          if (target) target.scrollIntoView();
        }
      });

    // adjust gutter for mobile
    if (window.innerWidth < 947) {
      $grid.masonry({ gutter: 22 });
    }

    // reload when crossing 947px breakpoint
    var ww = $(window).width();
    var limit = 947;
    function refresh() {
      ww = $(window).width();
      if (ww !== limit) window.location.reload(true);
    }
    var tOut;
    $(window).resize(function () {
      var resW = $(window).width();
      clearTimeout(tOut);
      if ((ww > limit && resW < limit) || (ww < limit && resW > limit)) {
        tOut = setTimeout(refresh, 100);
      }
    });

    // touch handlers for hover overlays
    document.querySelectorAll(".hover-on").forEach(function (element) {
      element.addEventListener("touchstart", function () {
        element.classList.add("touched");
      });
      element.addEventListener("touchend", function () {
        element.classList.remove("touched");
      });
    });
  });
});
