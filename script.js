document.addEventListener('DOMContentLoaded', () => {
    console.log("MoltenLava Hub Loaded. Forged with AI.");

    const cards = document.querySelectorAll('.card');

    // Add a subtle glow effect that follows the mouse
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // This sets CSS variables that we can use to position a glow
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
});