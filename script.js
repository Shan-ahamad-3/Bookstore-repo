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
    /**
     * Calls the Gemini API using exponential backoff for reliability.
     */
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
    /**
     * Fetches books and applies filtering (max 3 authors).
     */
    async function fetchBooks(query) {
        try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40`);
            const data = await res.json();
            if (!data.items) return [];

            // Filter: Remove anthologies/collections (more than 3 authors)
            return data.items.filter(book => (book.volumeInfo.authors?.length || 1) <= 3);
        } catch (err) {
            console.error("Search failed:", err);
            return [];
        }
    }

    /**
     * Sorts and renders book cards into a container.
     */
    function renderBooks(container, books) {
        container.innerHTML = '';
        
        if (books.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-500">No books found matching your criteria.</div>`;
            return;
        }

        // Sort: Books with fewer authors appear first for a cleaner look
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
     * Resets the home page to its initial state (Fresh start with Best Sellers)
     */
    async function resetHome() {
        searchInput.value = '';
        
        // Update the main header to reflect "Best Sellers"
        const mainTitle = document.querySelector('#home-view h1');
        if (mainTitle) {
            mainTitle.innerHTML = 'Current <span class="text-blue-500">Best Sellers</span>';
        }

        bookList.innerHTML = '<div class="loader"></div>';
        // Changed search query to fetch actual bestsellers
        const initialBooks = await fetchBooks("bestselling books 2025");
        renderBooks(bookList, initialBooks);
    }

    // --- Modal Control ---
    async function openModal(id) {
        modalContentBox.innerHTML = '<div class="loader"></div>';
        bookModal.classList.add('active'); // CSS handles display:flex via .active class
        
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

            // AI Logic: Summary
            document.getElementById('ai-sum-btn').onclick = async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                const box = document.getElementById('ai-response-box');
                box.classList.remove('hidden');
                box.innerHTML = '<div class="modal-loader"></div>';
                
                const prompt = `Summarize the book "${info.title}" by ${info.authors?.join(', ')}. Focus on the hook and theme for a potential reader. Spoiler-free. Max 4 sentences.`;
                const summary = await callGemini(prompt);
                
                box.innerHTML = `<p class="italic text-purple-100 leading-relaxed">"${summary}"</p>`;
                document.getElementById('book-description').classList.add('hidden');
            };

            // AI Logic: Questions
            document.getElementById('ai-ques-btn').onclick = async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                const box = document.getElementById('ai-response-box');
                box.classList.remove('hidden');
                box.innerHTML = '<div class="modal-loader"></div>';
                
                const questions = await callGemini(`Provide 3 deep discussion questions for the book "${info.title}".`);
                box.innerHTML = `<div class="text-sm leading-relaxed">${questions.replace(/\n/g, '<br>')}</div>`;
            };

            document.getElementById('close-modal').onclick = closeModal;
        } catch (err) {
            modalContentBox.innerHTML = `<p class="text-red-400 text-center py-10">Error loading details. Please try again.</p>`;
        }
    }

    function closeModal() {
        bookModal.classList.remove('active');
        setTimeout(() => { modalContentBox.innerHTML = ''; }, 300);
    }

    // --- Event Listeners ---
    document.addEventListener('click', async (e) => {
        // Modal Triggers
        const trigger = e.target.closest('.book-trigger');
        if (trigger) openModal(trigger.dataset.id);

        // Favorite Toggle
        const favBtn = e.target.closest('.fav-btn');
        if (favBtn) {
            const id = favBtn.dataset.id;
            const index = favorites.findIndex(f => f.id === id);
            
            if (index > -1) {
                favorites.splice(index, 1);
                favBtn.classList.remove('favorited');
            } else {
                const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
                const book = await res.json();
                favorites.push(book);
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
            
            if (viewId === 'home-view') resetHome();
            if (viewId === 'favorites-view') renderBooks(document.getElementById('favorites-list'), favorites);
            if (viewId === 'authors-pick-view') {
                const container = document.getElementById('authors-pick-list');
                container.innerHTML = '<div class="loader"></div>';
                renderBooks(container, await fetchBooks("Pulitzer Prize bestsellers"));
            }
        };
    });

    logo.onclick = (e) => { 
        e.preventDefault(); 
        navigate('home-view');
        resetHome();
    };

    // Search Operations
    searchButton.onclick = async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        // Reset the header when a specific search is performed
        const mainTitle = document.querySelector('#home-view h1');
        if (mainTitle) {
            mainTitle.innerHTML = 'Search <span class="text-blue-500">Results</span>';
        }

        bookList.innerHTML = '<div class="loader"></div>';
        const books = await fetchBooks(query);
        renderBooks(bookList, books);
    };

    searchInput.onkeyup = (e) => e.key === 'Enter' && searchButton.onclick();

    // Genre Quick-Click
    genreSection.onclick = async (e) => {
        const genre = e.target.dataset.genre;
        if (!genre) return;
        searchInput.value = genre;

        // Update title for genre discovery
        const mainTitle = document.querySelector('#home-view h1');
        if (mainTitle) {
            mainTitle.innerHTML = `Top <span class="text-blue-500">${genre}</span> Books`;
        }

        bookList.innerHTML = '<div class="loader"></div>';
        
        // FIX: Mapping "Sci-Fi" to "Science Fiction" for Google Books API compatibility
        let searchQuery = `subject:${genre}`;
        if (genre.toLowerCase() === 'sci-fi') {
            searchQuery = 'subject:science fiction';
        }

        renderBooks(bookList, await fetchBooks(searchQuery));
    };

    bookModal.onclick = (e) => e.target === bookModal && closeModal();

    // --- Initialization ---
    resetHome();
});
