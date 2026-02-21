document.addEventListener('DOMContentLoaded', () => {
    console.log("MoltenLava Hub Loaded.");

    // 1. Glow Effect for the main button
    const glowTargets = document.querySelectorAll('.glow-target');
    glowTargets.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            el.style.setProperty('--mouse-x', `${x}px`);
            el.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 2. Scroll Animation Logic (The Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Triggers when 15% of the element is visible
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add the 'visible' class to trigger the CSS animation
                entry.target.classList.add('visible');
                
                // Optional: Stop observing once it's visible if you only want it to animate once
                // observer.unobserve(entry.target); 
            } else {
                // Remove this line if you want elements to stay visible after scrolling past them
                entry.target.classList.remove('visible'); 
            }
        });
    }, observerOptions);

    // Grab all elements with the 'scroll-reveal' class and observe them
    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => {
        scrollObserver.observe(el);
    });
});
