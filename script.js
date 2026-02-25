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
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Grab all elements with the 'scroll-reveal' class and observe them
    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => {
        scrollObserver.observe(el);
    });

    /* --- Reviews Carousel Logic --- */
    const track = document.getElementById('reviewTrack');
    const prevBtn = document.getElementById('prevReview');
    const nextBtn = document.getElementById('nextReview');
    const dotsContainer = document.getElementById('reviewDots');

    if (track && prevBtn && nextBtn && dotsContainer) {
        const cards = Array.from(track.children);
        const cardCount = cards.length;
        let currentIndex = 0;
        let autoScrollTimer;

        // Create dots
        cards.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('carousel-dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                goToReview(i);
                resetTimer();
            });
            dotsContainer.appendChild(dot);
        });
        const dots = Array.from(dotsContainer.children);

        function updateCarousel() {
            // Calculate width plus gap
            const cardWidth = cards[0].getBoundingClientRect().width;
            const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
            const shift = (cardWidth + gap) * currentIndex;

            track.style.transform = `translateX(-${shift}px)`;

            // Update dots
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });

            // Manage button states
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex === cardCount - 1;

            prevBtn.style.opacity = prevBtn.disabled ? '0.3' : '1';
            nextBtn.style.opacity = nextBtn.disabled ? '0.3' : '1';
        }

        function goToReview(index) {
            currentIndex = Math.max(0, Math.min(index, cardCount - 1));
            updateCarousel();
        }

        function nextReview() {
            if (currentIndex < cardCount - 1) {
                goToReview(currentIndex + 1);
            } else {
                goToReview(0); // loop back
            }
        }

        prevBtn.addEventListener('click', () => {
            goToReview(currentIndex - 1);
            resetTimer();
        });

        nextBtn.addEventListener('click', () => {
            nextReview();
            resetTimer();
        });

        function startTimer() {
            autoScrollTimer = setInterval(nextReview, 5000); // 5 seconds
        }

        function resetTimer() {
            clearInterval(autoScrollTimer);
            startTimer();
        }

        // Initialize
        updateCarousel();
        startTimer();

        // Handle window resize
        window.addEventListener('resize', () => {
            track.style.transition = 'none'; // disable transition during resize
            updateCarousel();
            setTimeout(() => {
                track.style.transition = 'transform 0.4s ease-out';
            }, 50);
        });

        // Pause on hover
        track.addEventListener('mouseenter', () => clearInterval(autoScrollTimer));
        track.addEventListener('mouseleave', startTimer);
    }
});