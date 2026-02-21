document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIG ---
    const STORAGE_KEY = 'moltenSlides_beta'; 

    // --- STATE ---
    let activeDeleteId = null;
    let activeRenameId = null;

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
    saveToStorage(); 

    // --- 2. DOM ELEMENTS ---
    const grid = document.getElementById('slidesGrid');
    const searchInput = document.getElementById('searchInput');
    const modalOverlay = document.getElementById('modalOverlay');
    const deleteModal = document.getElementById('deleteModal');
    const renameModal = document.getElementById('renameModal');

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
    }

    function generatePreviewHTML(elements) {
        if(!elements) return '';
        let html = '';
        elements.forEach(el => {
            if (el.type === 'title') {
                html += `<h1 style="position:absolute; left:${el.x}px; top:${el.y}px; font-size:${el.fontSize}px; margin:0; color:#000; white-space:nowrap; font-family: 'Inter', sans-serif;">${el.text}</h1>`;
            } else if (el.type === 'text') {
                html += `<p style="position:absolute; left:${el.x}px; top:${el.y}px; font-size:${el.fontSize}px; margin:0; color:#666; white-space:nowrap; font-family: 'Inter', sans-serif;">${el.text}</p>`;
            }
        });
        return html;
    }

    // --- 3. RENDER ENGINE ---
    function render(filter = "") {
        if (!grid) return;
        grid.innerHTML = "";

        // A. Create "New Slide" Card
        const newCard = document.createElement('div');
        newCard.className = 'card card-new glow-target scroll-reveal'; // Added animation class
        newCard.innerHTML = `
            <div style="background: rgba(255, 94, 58, 0.1); border-radius: 50%; padding: 12px; margin-bottom: 1rem; border: 1px solid rgba(255, 94, 58, 0.2);">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--accent-orange)"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.2rem; color: var(--text-main);">New Blank Deck</h3>
            <p style="font-size: 0.85rem; margin: 0; color: var(--text-faint);">Start from scratch</p>
        `;
        newCard.onclick = createNewDeck;
        grid.appendChild(newCard);

        // B. Render Existing Slides
        const filteredSlides = slides.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));

        filteredSlides.forEach((slide, index) => {
            const el = document.createElement('div');
            // Added animation classes with cascading delays
            const delayClass = index < 3 ? `delay-${index + 1}` : 'delay-3';
            el.className = `card file-card glow-target scroll-reveal ${delayClass}`;
            
            el.onclick = (e) => {
                if(e.target.closest('.card-menu-btn') || e.target.closest('.menu-dropdown')) return;
                window.location.href = `Slides/index.html?id=${slide.id}`; // Fixed path if it's in a subfolder
            };

            const scale = 0.23;
            const previewElements = slide.pages && slide.pages[0] ? slide.pages[0].elements : [];

            el.innerHTML = `
                <button class="card-menu-btn" onclick="window.toggleMenu(event, ${slide.id})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
                
                <div class="menu-dropdown hidden" id="menu-${slide.id}" style="right: 12px; top: 48px;">
                    <div class="menu-item" onclick="window.triggerRename(event, ${slide.id}, '${slide.title.replace(/'/g, "\\'")}')">Rename</div>
                    <div class="context-divider"></div>
                    <div class="menu-item danger" onclick="window.triggerDelete(event, ${slide.id}, '${slide.title.replace(/'/g, "\\'")}')">Delete</div>
                </div>
                
                <div class="card-thumb">
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
        initAnimations(); // Fire the scroll reveals
    }

    // --- 4. ACTIONS & MODALS ---
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

    // --- Custom Modal Wiring ---
    window.closeModals = () => {
        modalOverlay.classList.add('hidden');
        deleteModal.classList.add('hidden');
        renameModal.classList.add('hidden');
        activeDeleteId = null;
        activeRenameId = null;
    };

    // Delete Flow
    window.triggerDelete = (e, id, title) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
        activeDeleteId = id;
        document.getElementById('deleteTargetName').innerText = title;
        modalOverlay.classList.remove('hidden');
        deleteModal.classList.remove('hidden');
    };

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
        if(activeDeleteId) {
            slides = slides.filter(s => s.id !== activeDeleteId);
            saveToStorage();
            render(searchInput.value);
        }
        window.closeModals();
    });

    // Rename Flow
    window.triggerRename = (e, id, currentTitle) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
        activeRenameId = id;
        const input = document.getElementById('renameInput');
        input.value = currentTitle;
        modalOverlay.classList.remove('hidden');
        renameModal.classList.remove('hidden');
        input.focus();
    };

    document.getElementById('confirmRenameBtn')?.addEventListener('click', () => {
        const newName = document.getElementById('renameInput').value.trim();
        if(activeRenameId && newName) {
            const s = slides.find(s => s.id === activeRenameId);
            if(s) s.title = newName;
            saveToStorage();
            render(searchInput.value);
        }
        window.closeModals();
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
    });

    // --- 5. UI UTILITIES ---
    function reapplyGlow() {
        document.querySelectorAll('.glow-target').forEach(el => {
            el.onmousemove = e => {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }
        });
    }

    function initAnimations() {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, observerOptions);

        document.querySelectorAll('.scroll-reveal').forEach(el => scrollObserver.observe(el));
    }

    // Bind Search
    if(searchInput) searchInput.addEventListener('input', (e) => render(e.target.value));
    
    // Initial Render
    render();
});
