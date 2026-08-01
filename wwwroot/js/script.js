document.addEventListener('DOMContentLoaded', () => {
    const navShell = document.querySelector('[data-nav-shell]');
    const revealItems = Array.from(document.querySelectorAll('.reveal'));

    const toggleNav = () => {
        if (!navShell) return;
        const scrolled = window.scrollY > 24;
        navShell.classList.toggle('is-scrolled', scrolled);
        navShell.classList.toggle('is-hidden', scrolled && window.scrollY > (window.lastScrollY ?? 0));
        window.lastScrollY = window.scrollY;
    };

    window.addEventListener('scroll', toggleNav, { passive: true });
    toggleNav();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.16
    });

    revealItems.forEach((item) => observer.observe(item));
});