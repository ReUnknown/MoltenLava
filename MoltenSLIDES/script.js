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

    function generatePreviewHTML(elements, page) {
        if (!elements) return '';
        let html = '';
        // Background support
        if (page && page.background) {
            html += `<div style="position:absolute;inset:0;background:${page.background};z-index:0;"></div>`;
        }
        elements.forEach((el, index) => {
            const w = el.width ? `width:${el.width}px;` : (el.type === 'image' ? 'width:300px;' : 'width:auto;');
            const h = el.height ? `height:${el.height}px;` : (el.type === 'image' ? 'height:300px;' : 'height:auto;');
            const rot = el.rotation ? `transform: rotate(${el.rotation}deg);` : '';
            let shadow = '';
            if (el.shadow && el.shadow !== 'none') {
                shadow = (el.type === 'text' || el.type === 'title') ? `text-shadow:${el.shadow};` : `box-shadow:${el.shadow};`;
            }
            let outline = '';
            if (el.outline && el.outline !== 'none') {
                outline = (el.type === 'text' || el.type === 'title') ? `-webkit-text-stroke:${el.outline};` : `outline:${el.outline};`;
            }
            const baseStyle = `position:absolute; left:${el.x || 0}px; top:${el.y || 0}px; ${w} ${h} z-index:${index}; ${rot} ${shadow} ${outline}`;
            let inner = '';

            if (el.type === 'text' || el.type === 'title') {
                const font = el.fontFamily || 'Inter, sans-serif';
                const size = el.fontSize || 40;
                const color = el.color || (el.type === 'title' ? '#000' : '#666');
                const weight = el.fontWeight || (el.type === 'title' ? 'bold' : 'normal');
                const style = el.fontStyle || 'normal';
                const decoration = el.textDecoration || 'none';
                const align = el.textAlign || 'left';
                inner = `<div style="${baseStyle} font-family:${font}; font-size:${size}px; color:${color}; font-weight:${weight}; font-style:${style}; text-decoration:${decoration}; text-align:${align}; margin:0; overflow:hidden;">${el.text || ''}</div>`;
            } else if (el.type === 'image') {
                inner = `<div style="${baseStyle} overflow:hidden;"><img src="${el.src || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"></div>`;
            } else if (el.type === 'rect') {
                inner = `<div style="${baseStyle}"><div style="width:100%;height:100%;background:${el.fill || '#3b82f6'};border:${el.strokeWidth || 2}px solid ${el.stroke || '#000'};"></div></div>`;
            } else if (el.type === 'circle') {
                inner = `<div style="${baseStyle}"><div style="width:100%;height:100%;background:${el.fill || '#3b82f6'};border:${el.strokeWidth || 2}px solid ${el.stroke || '#000'};border-radius:50%;"></div></div>`;
            } else if (el.type === 'line') {
                inner = `<div style="${baseStyle}"><div style="width:100%;height:${el.strokeWidth || 2}px;background:${el.stroke || '#000'};"></div></div>`;
            } else if (el.type === 'triangle') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            } else if (el.type === 'arrow') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 40"><path d="M 0,20 L 70,20 L 70,10 L 100,25 L 70,40 L 70,30 L 0,30 Z" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            } else if (el.type === 'star') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 61,35 90,35 67,55 78,85 50,65 22,85 33,55 10,35 39,35" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            } else if (el.type === 'heart') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 100"><path d="M50,90 C50,90 10,60 10,40 C10,25 20,15 30,15 C40,15 45,20 50,30 C55,20 60,15 70,15 C80,15 90,25 90,40 C90,60 50,90 50,90 Z" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            } else if (el.type === 'diamond') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 90,50 50,90 10,50" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            } else if (el.type === 'hexagon') {
                inner = `<div style="${baseStyle}"><svg width="100%" height="100%" viewBox="0 0 100 100"><polygon points="25,10 75,10 95,50 75,90 25,90 5,50" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg></div>`;
            }
            html += inner;
        });
        return html;
    }

    // --- 3. RENDER ENGINE ---
    function render(filter = "") {
        if (!grid) return;
        grid.innerHTML = "";

        // A. Remove manual "New Slide" card injection (already handled within index.html statically)
        // Ensure we wipe any old injected grid data
        // We will natively inject the New Blank deck back in via JS
        grid.innerHTML = "";

        const newCard = document.createElement('div');
        newCard.onclick = createNewDeck;
        newCard.style.cursor = 'pointer';
        newCard.className = 'slides-card';
        newCard.style.borderStyle = 'dashed';
        newCard.style.background = 'rgba(59, 130, 246, 0.05)';
        newCard.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        newCard.innerHTML = `
            <div class="slides-card-preview" style="background: transparent;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--accent-blue)" style="opacity: 0.8;">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
            </div>
            <div class="slides-card-info" style="text-align: center; border-top: none;">
                <h3 class="slides-card-title" style="color: var(--accent-blue);">New Blank Deck</h3>
                <div class="slides-card-meta">Start defining a new presentation stack</div>
            </div>
        `;
        grid.appendChild(newCard);

        // B. Render Existing Slides
        const filteredSlides = slides.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));

        if (filteredSlides.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; border-radius: 20px; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.1); margin-top: 1rem;';
            empty.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-faint)" style="margin-bottom: 1rem;">
                    <path d="M12 2C12 2 4 8 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 8 12 2 12 2Z"/>
                </svg>
                <h3 style="color: var(--text-muted); font-size: 1.2rem; margin-bottom: 0.5rem;">${filter ? 'No presentations found' : 'No presentations yet'}</h3>
                <p style="color: var(--text-faint); font-size: 0.9rem;">${filter ? 'Try a different search term' : 'Click the New Blank Deck card to get started!'}</p>
            `;
            grid.appendChild(empty);
        }

        filteredSlides.forEach((slide, index) => {
            const delay = index * 0.1;
            const el = document.createElement('div');
            el.className = 'slides-card';
            el.style.animationDelay = `${delay}s`;

            const firstPageElements = slide.pages && slide.pages[0] ? slide.pages[0].elements : [];
            const firstPage = slide.pages && slide.pages[0] ? slide.pages[0] : null;

            el.innerHTML = `
                <div class="slides-card-preview" style="cursor:pointer;" onclick="window.location.href='Slides/index.html?id=${slide.id}'" oncontextmenu="window.toggleMenu(event, ${slide.id})">
                    <div style="position: absolute; top: 0; left: 0; transform: scale(0.22); transform-origin: top left; width: 1280px; height: 720px; background: ${firstPage && firstPage.background ? firstPage.background : '#fff'}; pointer-events: none;">
                        ${generatePreviewHTML(firstPageElements, firstPage)}
                    </div>
                </div>
                <div class="slides-card-info" style="cursor:pointer;" onclick="window.location.href='Slides/index.html?id=${slide.id}'" oncontextmenu="window.toggleMenu(event, ${slide.id})">
                    <h3 class="slides-card-title">${slide.title}</h3>
                    <div class="slides-card-meta">Updated: ${slide.date || 'Unknown'}</div>
                </div>
                <button class="card-menu-btn" onclick="window.toggleMenu(event, ${slide.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                    </svg>
                </button>
                <div class="menu-dropdown hidden" id="menu-${slide.id}" style="right: 12px; top: 48px; position:absolute; z-index:50;">
                    <div class="menu-item" onclick="window.triggerRename(event, ${slide.id}, '${slide.title.replace(/'/g, "\\'")}')">Rename</div>
                    <div class="menu-item" onclick="window.triggerDuplicate(event, ${slide.id})">Duplicate</div>
                    <div class="context-divider"></div>
                    <div class="menu-item danger" onclick="window.triggerDelete(event, ${slide.id}, '${slide.title.replace(/'/g, "\\'")}')">Delete</div>
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
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
        document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
    };

    window.triggerDuplicate = (e, id) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.add('hidden'));
        const slideToCopy = slides.find(s => s.id === id);
        if (slideToCopy) {
            const newId = Date.now();
            const copy = JSON.parse(JSON.stringify(slideToCopy));
            copy.id = newId;
            copy.title = copy.title + " (Copy)";
            copy.date = new Date().toLocaleDateString();
            slides.unshift(copy);
            saveToStorage();
            render(searchInput.value);
        }
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
        if (activeDeleteId) {
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
        if (activeRenameId && newName) {
            const s = slides.find(s => s.id === activeRenameId);
            if (s) s.title = newName;
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
    let hubObserver = null;

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
        if (hubObserver) hubObserver.disconnect();
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
        hubObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.scroll-reveal').forEach(el => hubObserver.observe(el));
    }

    // Bind Search
    if (searchInput) searchInput.addEventListener('input', (e) => render(e.target.value));

    // Initial Render
    render();
});