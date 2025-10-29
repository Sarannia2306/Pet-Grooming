document.addEventListener('DOMContentLoaded', function() {
    // Initialize Daycare Carousel if it exists
    if (document.querySelector('.daycare-carousel')) {
        new Swiper('.daycare-carousel', {
            loop: true,
            autoplay: {
                delay: 3000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.daycare-pagination',
                clickable: true
            },
            navigation: {
                nextEl: '.daycare-next',
                prevEl: '.daycare-prev',
            },
        });
    }

    // Initialize Boarding Carousel if it exists
    if (document.querySelector('.boarding-carousel')) {
        new Swiper('.boarding-carousel', {
            loop: true,
            autoplay: {
                delay: 3500,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.boarding-pagination',
                clickable: true
            },
            navigation: {
                nextEl: '.boarding-next',
                prevEl: '.boarding-prev',
            },
        });
    }
});
