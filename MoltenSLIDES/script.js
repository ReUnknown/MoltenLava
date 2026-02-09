document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIG ---
    const STORAGE_KEY = 'moltenSlides_beta'; // New key to avoid conflicts

    // --- 1. SAFE DATA LOADER ---
    function safeLoad() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return getDefaultData();
            return JSON.parse(raw);
        } catch (e) {
            console.error("CORRUPT DATA DETECTED! Resetting storage...", e);
            localStorage.removeItem(STORAGE_KEY);
            return getDefaultData();
        }
    }

    function getDefaultData() {
        const now = new Date().toLocaleDateString();
        // Structure: Decks contain their own pages now to keep it simple
        return [
            { 
                id: 1, 
                title: 'Your First Presentation', 
                date: now,
                pages: [
                    { 
                        id: 'p1', 
                        elements: [
                            { id: 'el1', type: 'title', text: 'Welcome to Molten', x: 180, y: 250, fontSize: 90 },
                            { id: 'el2', type: 'text', text: 'Double click to edit text', x: 185, y: 380, fontSize: 40 }
                        ]
                    }
                ]
            }
        ];
    }

    // Initialize
    let slides = safeLoad();
    saveToStorage(); // Ensure defaults are saved if new

    // --- 2. RENDER ENGINE ---
    const grid = document.getElementById('slidesGrid');
    const searchInput = document.getElementById('searchInput');

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
    }

    // Helper to generate preview HTML
    function generatePreviewHTML(elements) {
        if(!elements) return '';
        let html = '';
        elements.forEach(el => {
            if (el.type === 'title') {
                html += `<h1 style="position:absolute; left:${el.x}px; top:${el.y}px; font-size:${el.fontSize}px; margin:0; color:#000; white-space:nowrap;">${el.text}</h1>`;
            } else if (el.type === 'text') {
                html += `<p style="position:absolute; left:${el.x}px; top:${el.y}px; font-size:${el.fontSize}px; margin:0; color:#666; white-space:nowrap;">${el.text}</p>`;
            }
        });
        return html;
    }

    function render(filter = "") {
        if (!grid) return;
        grid.innerHTML = "";

        // A. Create "New Slide" Card
        const newCard = document.createElement('div');
        newCard.className = 'card card-new glow-target';
        newCard.innerHTML = `
            <div class="new-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.2rem; color: var(--text-main);">New Blank Deck</h3>
            <p style="font-size: 0.8rem; margin: 0; color: var(--text-faint);">Start from scratch</p>
        `;
        newCard.onclick = createNewDeck;
        grid.appendChild(newCard);

        // B. Render Existing Slides
        const filteredSlides = slides.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));

        filteredSlides.forEach(slide => {
            const el = document.createElement('div');
            el.className = 'card file-card glow-target';
            el.style.position = 'relative';

            // Navigation Click
            el.onclick = (e) => {
                if(e.target.closest('.card-menu-btn') || e.target.closest('.menu-dropdown')) return;
                window.location.href = `Slides/index.html?id=${slide.id}`;
            };

            const scale = 0.23;
            // Use first page elements for preview
            const previewElements = slide.pages && slide.pages[0] ? slide.pages[0].elements : [];

            el.innerHTML = `
                <button class="card-menu-btn" onclick="toggleMenu(event, ${slide.id})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
                
                <div class="menu-dropdown hidden" id="menu-${slide.id}">
                    <div class="menu-item" onclick="renameSlide(event, ${slide.id})">Rename</div>
                    <div class="menu-item danger" onclick="deleteSlide(event, ${slide.id})">Delete</div>
                </div>
                
                <div class="card-thumb" style="background: white; position: relative; overflow: hidden;">
                    <div style="width: 1280px; height: 720px; transform: scale(${scale}); transform-origin: top left; pointer-events: none;">
                        ${generatePreviewHTML(previewElements)}
                    </div>
                </div>
                
                <div class="card-body">
                    <h4 class="card-title">${slide.title}</h4>
                    <p class="card-meta">${slide.date}</p>
                </div>
            `;
            grid.appendChild(el);
        });
        
        reapplyGlow();
    }

    // --- 3. ACTIONS ---
    function createNewDeck() {
        const newId = Date.now();
        const newDeck = {
            id: newId,
            title: 'Untitled Presentation',
            date: new Date().toLocaleDateString(),
            pages: [
                { 
                    id: 'p1', 
                    elements: [
                        { id: 'el1', type: 'title', text: 'Click to add title', x: 180, y: 250, fontSize: 90 }
                    ]
                }
            ]
        };
        slides.unshift(newDeck);
        saveToStorage();
        window.location.href = `Slides/index.html?id=${newId}`;
    }

    window.toggleMenu = (e, id) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
        document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
    };

    window.deleteSlide = (e, id) => {
        e.stopPropagation();
        if(confirm("Are you sure?")) {
            slides = slides.filter(s => s.id !== id);
            saveToStorage();
            render(searchInput.value);
        }
    };

    window.renameSlide = (e, id) => {
        e.stopPropagation();
        const name = prompt("New Name:");
        if(name) {
            const s = slides.find(s => s.id === id);
            if(s) s.title = name;
            saveToStorage();
            render(searchInput.value);
        }
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
    });

    function reapplyGlow() {
        document.querySelectorAll('.glow-target').forEach(el => {
            el.onmousemove = e => {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }
        });
    }

    if(searchInput) searchInput.addEventListener('input', (e) => render(e.target.value));
    render();
});