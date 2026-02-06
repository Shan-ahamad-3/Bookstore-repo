/**
 * The Book Nook - Core Logic
 * Md. Zeeshan Ahamad (Shan)
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const apiKey = ""; // API Key provided by the environment
    let favorites = JSON.parse(localStorage.getItem('nook_favs_v3')) || [];
    
    // --- UI Element Selectors ---
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const bookList = document.getElementById('book-list');
    const bookModal = document.getElementById('book-modal');
    const modalContentBox = document.getElementById('modal-content-box');
    const logo = document.getElementById('logo');
    const genreSection = document.getElementById('genre-section');

    // --- Gemini AI Integration ---
    async function callGemini(prompt, retries = 5, delay = 1000) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
        } catch (error) {
            if (retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return callGemini(prompt, retries - 1, delay * 2);
            }
            return "AI service is currently busy. Please try again later.";
        }
    }

    // --- Data Fetching & Logic ---
    async function fetchBooks(query) {
        try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40`);
            const data = await res.json();
            if (!data.items) return [];

            // Filter: Only show books with 3 or fewer authors to avoid massive collections
            return data.items.filter(book => (book.volumeInfo.authors?.length || 1) <= 3);
        } catch (err) {
            console.error("Search failed:", err);
            return [];
        }
    }

    function renderBooks(container, books) {
        container.innerHTML = '';
        
        if (books.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-500">No books found matching your criteria.</div>`;
            return;
        }

        // Sort: Least authors first for visual clarity
        books.sort((a, b) => {
            const countA = a.volumeInfo.authors?.length || 1;
            const countB = b.volumeInfo.authors?.length || 1;
            return countA - countB;
        });

        books.forEach(book => {
            const info = book.volumeInfo;
            const id = book.id;
            const isFav = favorites.some(f => f.id === id);
            
            const card = document.createElement('div');
            card.className = 'book-card bg-gray-800/40 p-5 rounded-3xl border border-gray-700/50 flex flex-col relative';
            card.innerHTML = `
                <button class="fav-btn absolute top-4 right-4 z-10 ${isFav ? 'favorited' : ''}" data-id="${id}">
                    <svg class="heart-icon w-7 h-7" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
                <img src="${info.imageLinks?.thumbnail || 'https://via.placeholder.com/150x220?text=No+Cover'}" 
                     class="w-full h-64 object-cover rounded-2xl mb-4 shadow-lg cursor-pointer book-trigger" data-id="${id}">
                <h3 class="font-bold text-lg leading-tight mb-2 line-clamp-2">${info.title}</h3>
                <p class="text-sm text-gray-400 mb-6">${info.authors?.join(', ') || 'Unknown Author'}</p>
                <div class="mt-auto flex gap-2">
                    <button class="flex-1 bg-gray-700 hover:bg-gray-600 py-2.5 rounded-xl text-xs font-bold book-trigger" data-id="${id}">SUMMARY</button>
                    <a href="${info.infoLink}" target="_blank" class="flex-1 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white py-2.5 rounded-xl text-xs font-bold text-center transition-all">BUY NOW</a>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // --- Navigation & View Logic ---
    function navigate(viewId) {
        views.forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Resets the home page to its initial state (Fresh start)
     */
    async function resetHome() {
        searchInput.value = '';
        bookList.innerHTML = '<div class="loader"></div>';
        const initialBooks = await fetchBooks("classic masterpieces");
        renderBooks(bookList, initialBooks);
    }

    // --- Modal Control ---
    async function openModal(id) {
        modalContentBox.innerHTML = '<div class="loader"></div>';
        bookModal.classList.add('active');
        
        try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
            const book = await res.json();
            const info = book.volumeInfo;

            modalContentBox.innerHTML = `
                <button class="absolute top-6 right-6 text-gray-400 hover:text-white text-3xl font-light" id="close-modal">✕</button>
                <div class="grid md:grid-cols-3 gap-10">
                    <img src="${info.imageLinks?.thumbnail || ''}" class="w-full rounded-2xl shadow-2xl">
                    <div class="md:col-span-2 space-y-6">
                        <h2 class="text-4xl font-black tracking-tight">${info.title}</h2>
                        <p class="text-xl text-blue-400 font-medium italic">by ${info.authors?.join(', ') || 'Unknown'}</p>
                        <div class="flex flex-wrap gap-4">
                            <button id="ai-sum-btn" class="gemini-btn px-6 py-3 rounded-2xl font-bold flex items-center gap-2">✨ AI Smart Summary</button>
                            <button id="ai-ques-btn" class="gemini-btn px-6 py-3 rounded-2xl font-bold flex items-center gap-2">✨ Book Club Questions</button>
                        </div>
                        <div id="ai-response-box" class="gemini-content hidden"></div>
                        <p class="text-gray-300 leading-relaxed text-lg" id="book-description">${info.description || 'No description available.'}</p>
                    </div>
                </div>
            `;

            document.getElementById('ai-sum-btn').onclick = async (e) => {
                e.currentTarget.disabled = true;
                const box = document.getElementById('ai-response-box');
                box.classList.remove('hidden');
                box.innerHTML = '<div class="modal-loader"></div>';
                const summary = await callGemini(`Summarize "${info.title}" by ${info.authors?.join(', ')} in exactly 3 impactful, spoiler-free sentences.`);
                box.innerHTML = `<p class="italic text-purple-100 leading-relaxed">"${summary}"</p>`;
                document.getElementById('book-description').classList.add('hidden');
            };

            document.getElementById('ai-ques-btn').onclick = async (e) => {
                e.currentTarget.disabled = true;
                const box = document.getElementById('ai-response-box');
                box.classList.remove('hidden');
                box.innerHTML = '<div class="modal-loader"></div>';
                const text = await callGemini(`Provide 3 discussion questions for "${info.title}".`);
                box.innerHTML = `<div class="text-sm leading-relaxed">${text.replace(/\n/g, '<br>')}</div>`;
            };

            document.getElementById('close-modal').onclick = closeModal;
        } catch (err) {
            modalContentBox.innerHTML = `<p class="text-red-400 text-center py-10">Error loading details.</p>`;
        }
    }

    function closeModal() {
        bookModal.classList.remove('active');
        setTimeout(() => { modalContentBox.innerHTML = ''; }, 300);
    }

    // --- Event Listeners ---
    document.addEventListener('click', async (e) => {
        const trigger = e.target.closest('.book-trigger');
        if (trigger) openModal(trigger.dataset.id);

        const favBtn = e.target.closest('.fav-btn');
        if (favBtn) {
            const id = favBtn.dataset.id;
            const index = favorites.findIndex(f => f.id === id);
            if (index > -1) {
                favorites.splice(index, 1);
                favBtn.classList.remove('favorited');
            } else {
                const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
                favorites.push(await res.json());
                favBtn.classList.add('favorited');
            }
            localStorage.setItem('nook_favs_v3', JSON.stringify(favorites));
        }
    });

    navLinks.forEach(link => {
        link.onclick = async (e) => {
            e.preventDefault();
            const viewId = link.dataset.view;
            navigate(viewId);
            
            // Logic integrated: Reset home if "Home" clicked in Navbar
            if (viewId === 'home-view') resetHome();
            if (viewId === 'favorites-view') renderBooks(document.getElementById('favorites-list'), favorites);
            if (viewId === 'authors-pick-view') {
                const container = document.getElementById('authors-pick-list');
                container.innerHTML = '<div class="loader"></div>';
                renderBooks(container, await fetchBooks("Pulitzer Prize bestsellers"));
            }
        };
    });

    // Logic integrated: Reset home if Logo is clicked
    logo.onclick = (e) => { 
        e.preventDefault(); 
        navigate('home-view');
        resetHome();
    };

    searchButton.onclick = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        bookList.innerHTML = '<div class="loader"></div>';
        renderBooks(bookList, await fetchBooks(query));
    };

    searchInput.onkeyup = (e) => e.key === 'Enter' && searchButton.onclick();

    genreSection.onclick = async (e) => {
        const genre = e.target.dataset.genre;
        if (!genre) return;
        searchInput.value = genre;
        bookList.innerHTML = '<div class="loader"></div>';
        renderBooks(bookList, await fetchBooks(`subject:${genre}`));
    };

    bookModal.onclick = (e) => e.target === bookModal && closeModal();

    // --- Initial Boot ---
    resetHome();
});
