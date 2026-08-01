document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 900,
        once: true,
        easing: 'ease-out-cubic',
        offset: 80
    });

    lucide.createIcons();
});
