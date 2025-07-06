function initializePageTransition(animation = 'slide-scale', duration = 500) {
    // Apply entry animation
    document.body.classList.add('page-enter', animation);

    // Handle exit animation on internal links
    document.querySelectorAll('a').forEach(link => {
        if (link.href && link.href.startsWith(window.location.origin)) {
            link.addEventListener('click', event => {
                event.preventDefault();
                const targetUrl = link.href;

                document.body.classList.remove('page-enter', animation);
                document.body.classList.add('page-exit', animation);

                setTimeout(() => {
                    window.location.href = targetUrl;
                }, duration);
            });
        }
    });
}
