(function ($) {

  "use strict";

  var initSlider = function () {

    // home swiper slide
    var swiper = new Swiper(".home-slider .swiper", {
      slidesPerView: 1,
      loop: true,
      speed: 900,
      // direction: "vertical",
      autoplay: {
        delay: 5000,
      },
      navigation: {
        nextEl: ".home-slider .icon-arrow-right",
        prevEl: ".home-slider .icon-arrow-left",
      },
    });

    $('.product-carousel').each(function () {
      var sectionId = $(this).attr('id');
      var swiper = new Swiper("#" + sectionId + " .swiper", {
        slidesPerView: 5,
        spaceBetween: 20,
        navigation: {
          nextEl: "#" + sectionId + " .icon-arrow-right",
          prevEl: "#" + sectionId + " .icon-arrow-left",
        },
        breakpoints: {
          0: {
            slidesPerView: 2,
            spaceBetween: 20,
            pagination: {
              el: ".swiper-pagination",
              clickable: true,
            }
          },
          999: {
            slidesPerView: 3,
            spaceBetween: 10,
          },
          1366: {
            slidesPerView: 5,
            spaceBetween: 40,
          },
        },
      });
    })

    var swiper = new Swiper(".testimonial-swiper", {
      grabCursor: true,
      centeredSlides: true,
      loop: true,
      slidesPerView: "auto",
      pagination: {
        el: ".testimonial-swiper-pagination",
        clickable: true,
      },
    });

  };

  // input spinner
  var initQuantitySpinner = function () {

    $('.product-qty').each(function () {

      var $el_product = $(this);
      var quantity = 0;

      $el_product.find('.quantity-right-plus').click(function (e) {
        e.preventDefault();
        var quantity = parseInt($el_product.find('#quantity').val());
        $el_product.find('#quantity').val(quantity + 1);
      });

      $el_product.find('.quantity-left-minus').click(function (e) {
        e.preventDefault();
        var quantity = parseInt($el_product.find('#quantity').val());
        if (quantity > 0) {
          $el_product.find('#quantity').val(quantity - 1);
        }
      });

    });

  }

  // init jarallax parallax
  var initJarallax = function () {
    jarallax(document.querySelectorAll(".jarallax"));

    jarallax(document.querySelectorAll(".jarallax-keep-img"), {
      keepImg: true,
    });
  }

  // Animate Texts
  var initTextFx = function () {
    $('.txt-fx').each(function () {
      var newstr = '';
      var count = 0;
      var delay = 300;
      var stagger = 10;
      var words = this.textContent.split(/\s/);

      $.each(words, function (key, value) {
        newstr += '<span class="word">';

        for (var i = 0, l = value.length; i < l; i++) {
          newstr += "<span class='letter' style='transition-delay:" + (delay + stagger * count) + "ms;'>" + value[i] + "</span>";
          count++;
        }
        newstr += '</span>';
        newstr += "<span class='letter' style='transition-delay:" + delay + "ms;'>&nbsp;</span>";
        count++;
      });

      this.innerHTML = newstr;
    });
  }

  var initScrollNav = function () {
    var scroll = $(window).scrollTop();

    if (scroll >= 200) {
      $('.navbar.fixed-top').addClass("bg-white").removeClass("text-white");
      $('.navbar.fixed-top .navbar-brand img').attr('src','images/logo.svg');
    } else {
      $('.navbar.fixed-top').removeClass("bg-white").addClass("text-white");
      $('.navbar.fixed-top .navbar-brand img').attr('src','images/light-logo.png');
    }
  }

  // init Isotope
  var initIsotope = function () {

    $('.grid').each(function () {

      var $buttonGroup = $('.button-group');
      var $checked = $buttonGroup.find('.is-checked');
      var filterValue = $checked.attr('data-filter');

      var $grid = $('.grid').isotope({
        itemSelector: '.product-item',
        layoutMode: 'fitRows',
        filter: filterValue
      });

      // bind filter button click
      $('.button-group').on('click', 'a', function (e) {
        e.preventDefault();
        filterValue = $(this).attr('data-filter');
        $grid.isotope({ filter: filterValue });
      });

      // change is-checked class on buttons
      $('.button-group').each(function (i, buttonGroup) {
        $buttonGroup.on('click', 'a', function () {
          $buttonGroup.find('.is-checked').removeClass('is-checked');
          $(this).addClass('is-checked');
        });
      });

    });
  }

  var searchPopup = function () {
    // open search box
    $('.navbar').on('click', '.search-button', function (e) {
      $('.search-popup').toggleClass('is-visible');
    });

    $('.navbar').on('click', '.btn-close-search', function (e) {
      $('.search-popup').toggleClass('is-visible');
    });

    $(".search-popup-trigger").on("click", function (b) {
      b.preventDefault();
      $(".search-popup").addClass("is-visible"),
        setTimeout(function () {
          $(".search-popup").find("#search-popup").focus()
        }, 350)
    }),
      $(".search-popup").on("click", function (b) {
        ($(b.target).is(".search-popup-close") || $(b.target).is(".search-popup-close svg") || $(b.target).is(".search-popup-close path") || $(b.target).is(".search-popup")) && (b.preventDefault(),
          $(this).removeClass("is-visible"))
      }),
      $(document).keyup(function (b) {
        "27" === b.which && $(".search-popup").removeClass("is-visible")
      })
  }

  // $(window).scroll(function () {
  //   initScrollNav();
  // });

  $(window).load(function () {
    $(".preloader").addClass("loaded");

    $(".btn-nav").on("click tap", function () {
      $(".nav-content").toggleClass("showNav hideNav").removeClass("hidden");
      $(this).toggleClass("animated");
    });

    initIsotope();
  });

  // document ready
  $(document).ready(function () {
    searchPopup();
    initJarallax();
    initTextFx();
    initQuantitySpinner();
    initSlider();

    $(".youtube").colorbox({
      iframe: true,
      innerWidth: 960,
      innerHeight: 585
    });

    AOS.init({
      duration: 1200,
      once: true,
    });

    var count = 0;
    var delay = 300;
    $('.slide-clip-animation .image-holder').each(function(){
      count++;
      $(this).attr("style", "animation-delay:"+ delay*count +"ms;");
    });
    
    var Sticky = new hcSticky('.sticky-info', {
      stickTo: 'section.single-product',
      innerTop: 200,
      // followScroll: false,
      responsive: {
        980: {
          disable: true
        }
      }
    });

  }); // document ready

})(jQuery)