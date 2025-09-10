// --- JAVASCRIPT LOGIC ---
// Wait for the entire HTML page to be loaded and parsed before running the script.
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT SELECTORS ---
    // Get references to all the important, interactive elements from the HTML.
    const allViews = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const bookList = document.getElementById('book-list');
    const authorsPickList = document.getElementById('authors-pick-list');
    const favoritesList = document.getElementById('favorites-list');
    const bookModal = document.getElementById('book-modal');
    const modalContentBox = document.getElementById('modal-content-box');
    const logo = document.getElementById('logo');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const genreSection = document.getElementById('genre-section');

    // This array will hold the user's favorite book objects.
    let favorites = [];

    // --- GEMINI API INTEGRATION ---
    /**
     * Calls the Gemini API with a specific prompt.
     * Includes error handling and an exponential backoff retry mechanism.
     * @param {string} prompt - The question or instruction for the AI.
     * @param {number} retryCount - How many times to retry on failure.
     * @param {number} delay - The initial delay between retries in milliseconds.
     * @returns {Promise<string>} The text response from the AI.
     */
    const callGemini = async (prompt, retryCount = 3, delay = 1000) => {
        // The API key is an empty string; the execution environment provides it.
        const apiKey = ""; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // If the API is busy (rate-limited), wait and try again.
                if (response.status === 429 && retryCount > 0) {
                    await new Promise(res => setTimeout(res, delay));
                    return callGemini(prompt, retryCount - 1, delay * 2); // Double the delay for the next retry.
                }
                throw new Error(`API Error: ${response.status}`);
            }
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (error) {
            console.error("Gemini API call failed:", error);
            return "Sorry, the AI is taking a break. Please try again in a moment.";
        }
    };

    /**
     * Generates and displays an AI-powered summary for a book.
     * @param {HTMLElement} button - The button element that was clicked.
     * @param {string} title - The title of the book.
     * @param {string} authors - The author(s) of the book.
     */
    window.generateAISummary = async (button, title, authors) => {
        const summaryContainer = document.getElementById('ai-summary-content');
        button.disabled = true;
        summaryContainer.innerHTML = '<div class="modal-loader"></div>';
        summaryContainer.classList.remove('hidden');

        const prompt = `Provide a concise and engaging summary for the book "${title}" by ${authors}. Focus on the main plot and themes without giving away major spoilers. Format it as a single, well-written paragraph.`;
        const summary = await callGemini(prompt);
        
        document.getElementById('original-description').classList.add('hidden');
        summaryContainer.innerHTML = summary;
        button.style.display = 'none'; // Hide button after use.
    };
    
    /**
     * Generates and displays book club discussion questions.
     * @param {HTMLElement} button - The button element that was clicked.
     * @param {string} title - The title of the book.
     * @param {string} authors - The author(s) of the book.
     */
    window.generateDiscussionQuestions = async (button, title, authors) => {
        const questionsContainer = document.getElementById('ai-questions-content');
        button.disabled = true;
        questionsContainer.innerHTML = '<div class="modal-loader"></div>';
        questionsContainer.classList.remove('hidden');

        const prompt = `Generate a list of 5 thought-provoking book club discussion questions for "${title}" by ${authors}. The questions should encourage deep thinking about the characters, plot, and themes. Format the response as a numbered list.`;
        let questions = await callGemini(prompt);
        
        // Clean and format the raw text response into a proper HTML list.
        questions = '<ul>' + questions.split(/\d+\.\s/).filter(q => q.trim()).map(q => `<li>${q.trim()}</li>`).join('') + '</ul>';
        questionsContainer.innerHTML = questions;
        button.style.display = 'none'; // Hide button after use.
    };

    // --- CORE APPLICATION FUNCTIONS ---
    
    /**
     * Fetches book data from the Google Books API based on a query.
     * @param {string} query - The search term.
     * @param {number} maxResults - The maximum number of results to fetch.
     * @returns {Promise<Array|null>} An array of book objects or null on error.
     */
    const fetchBooks = async (query, maxResults = 40) => {
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.items) return [];

            // Filter out books with more than 3 authors to avoid large collections/anthologies.
            return data.items.filter(book => (book.volumeInfo.authors?.length || 1) <= 3);
        } catch (error) {
            console.error("Error fetching data from Google Books API:", error);
            return null;
        }
    };

    /**
     * Renders an array of books into a specified HTML container.
     * @param {HTMLElement} container - The container to display the books in.
     * @param {Array} books - The array of book objects.
     */
    const renderBooks = (container, books) => {
        container.innerHTML = '';
        const booksToDisplay = books ? books.slice(0, 20) : [];

        if (booksToDisplay.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-16"><p class="text-lg">No books found matching your criteria.</p></div>`;
            return;
        }

        // Sort books by the number of authors (fewest first) for a cleaner layout.
        booksToDisplay.sort((a, b) => (a.volumeInfo.authors?.length || 1) - (b.volumeInfo.authors?.length || 1));
        
        const bookCardsHtml = booksToDisplay.map(book => {
            const { id, volumeInfo } = book;
            const title = volumeInfo.title || 'No Title Available';
            const authors = volumeInfo.authors?.join(', ') || 'Unknown Author';
            const coverImage = volumeInfo.imageLinks?.thumbnail || `https://placehold.co/128x192/1f2937/9ca3af?text=No+Cover`;
            const infoLink = volumeInfo.infoLink;
            const isFavorited = favorites.some(fav => fav.id === id);

            return `
                <div class="book-card bg-gray-800 rounded-lg p-4 flex flex-col items-center text-center relative">
                    <div class="fav-btn ${isFavorited ? 'favorited' : ''}" data-book-id="${id}">
                        <svg class="heart-icon h-6 w-6 absolute top-2 right-2 pointer-events-none" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                    </div>
                    <img src="${coverImage}" alt="Cover of ${title}" class="book-cover w-32 h-48 object-cover rounded-md mb-4 shadow-lg cursor-pointer" data-book-id="${id}">
                    <h3 class="font-bold text-md mb-1 text-gray-100 flex-grow">${title}</h3>
                    <p class="text-sm text-gray-400 mb-4">${authors}</p>
                    <div class="flex flex-col sm:flex-row gap-2 mt-auto w-full">
                       <button class="summary-btn flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-full text-sm transition-colors" data-book-id="${id}">Summary</button>
                       ${infoLink ? `<a href="${infoLink}" target="_blank" rel="noopener noreferrer" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-full text-sm transition-colors">Buy Now</a>` : ''}
                    </div>
                </div>`;
        }).join('');
        container.innerHTML = bookCardsHtml;
    };

    /**
     * Opens the modal with detailed information for a specific book.
     * @param {string} bookId - The unique ID of the book.
     */
    window.openModal = async (bookId) => {
        modalContentBox.innerHTML = '<div class="loader"></div>';
        bookModal.style.display = 'flex';
        setTimeout(() => bookModal.classList.add('active'), 10);
        
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}`);
            if (!response.ok) throw new Error('Failed to fetch book details.');
            const book = await response.json();
            const { volumeInfo } = book;
            const title = volumeInfo.title || 'N/A';
            const authors = volumeInfo.authors?.join(', ') || 'N/A';
            const description = volumeInfo.description || 'No summary available for this book.';
            const coverImage = volumeInfo.imageLinks?.thumbnail || 'https://placehold.co/150x225/1f2937/9ca3af?text=No+Cover';
            
            // Sanitize title and authors for use in onclick attributes.
            const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            const safeAuthors = authors.replace(/"/g, '&quot;').replace(/'/g, "\\'");

            modalContentBox.innerHTML = `
                <button class="modal-close-btn"><svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="flex-shrink-0 text-center"><img src="${coverImage}" alt="Cover of ${title}" class="w-40 h-60 object-cover rounded-md shadow-lg mx-auto"></div>
                    <div class="flex-1">
                        <h2 class="text-3xl font-bold mb-2">${title}</h2>
                        <p class="text-lg text-gray-400 mb-4">by ${authors}</p>
                        <div class="flex flex-wrap gap-4 my-4">
                           <button class="gemini-btn text-white font-semibold py-2 px-4 rounded-full transition-all" onclick="generateAISummary(this, '${safeTitle}', '${safeAuthors}')">✨ Generate AI Summary</button>
                           <button class="gemini-btn text-white font-semibold py-2 px-4 rounded-full transition-all" onclick="generateDiscussionQuestions(this, '${safeTitle}', '${safeAuthors}')">✨ Get Discussion Questions</button>
                        </div>
                        <p id="original-description" class="mb-4">${description}</p>
                        <div id="ai-summary-content" class="gemini-content hidden"></div>
                        <div id="ai-questions-content" class="gemini-content hidden"></div>
                        <div class="text-sm text-gray-500 mt-6"><p><strong>Publisher:</strong> ${volumeInfo.publisher || 'N/A'}</p><p><strong>Published Date:</strong> ${volumeInfo.publishedDate || 'N/A'}</p></div>
                    </div>
                </div>`;
        } catch (error) {
            console.error('Error in openModal:', error);
            modalContentBox.innerHTML = `<div class="text-center p-8"><h2 class="text-2xl font-bold text-red-400 mb-4">Error</h2><p class="text-gray-300">Could not load book details. Please try again.</p></div>`;
        }
    };

    /** Closes the modal window. */
    const closeModal = () => {
        bookModal.classList.remove('active');
        setTimeout(() => { bookModal.style.display = 'none'; modalContentBox.innerHTML = ''; }, 300);
    };
    
    /** Displays a loading spinner in a given container. */
    const showLoading = (container) => { container.innerHTML = '<div class="loader col-span-full"></div>'; };
    
    /** Switches between different views (e.g., Home, Favorites). */
    const showView = (viewId) => {
        allViews.forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
    };
    
    /** Initiates a book search based on the input field's value. */
    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return; // Don't search if the input is empty.
        showView('home-view');
        showLoading(bookList);
        renderBooks(bookList, await fetchBooks(query));
    };
    
    // --- FAVORITES LOGIC ---
    const loadFavorites = () => { favorites = JSON.parse(localStorage.getItem('bookNookFavorites')) || []; };
    const saveFavorites = () => { localStorage.setItem('bookNookFavorites', JSON.stringify(favorites)); };

    const toggleFavorite = async (bookId) => {
        const bookIndex = favorites.findIndex(fav => fav.id === bookId);

        if (bookIndex > -1) { // If already a favorite, remove it.
            favorites.splice(bookIndex, 1);
        } else { // If not a favorite, fetch its full data and add it.
            try {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}`);
                if (!response.ok) throw new Error('Failed to fetch book for favoriting.');
                favorites.push(await response.json());
            } catch (error) { console.error(error); return; }
        }
        saveFavorites();
        
        // Re-render the current view to reflect the change in favorite status.
        const currentViewId = document.querySelector('.view:not(.hidden)').id;
        const currentSearchQuery = searchInput.value.trim() || "classic literature";
        if (currentViewId === 'home-view') renderBooks(bookList, await fetchBooks(currentSearchQuery));
        else if (currentViewId === 'authors-pick-view') displayAuthorsPicks();
        else if (currentViewId === 'favorites-view') displayFavorites();
    };

    const displayFavorites = () => {
        if (favorites.length === 0) { 
            favoritesList.innerHTML = `<div class="col-span-full text-center text-gray-400 py-16"><p class="text-lg">You haven't added any books to your favorites yet.</p></div>`;
            return; 
        }
        renderBooks(favoritesList, favorites);
    };

    const displayAuthorsPicks = async () => {
        showLoading(authorsPickList);
        renderBooks(authorsPickList, await fetchBooks("Pulitzer Prize for Fiction"));
    };
    
    // --- EVENT LISTENERS ---
    // Handle clicks on navigation links.
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('data-view');
            showView(viewId);
            if (viewId === 'favorites-view') displayFavorites();
            if (viewId === 'authors-pick-view') displayAuthorsPicks();
        });
    });

    // Handle click on the logo to go home.
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        showView('home-view');
    });

    // Handle search button click and Enter key press.
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (e) => e.key === 'Enter' && performSearch());

    // Handle clicks on genre buttons.
    genreSection.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.genre) {
            const genre = e.target.dataset.genre;
            searchInput.value = genre;
            showView('home-view');
            showLoading(bookList);
            renderBooks(bookList, await fetchBooks(`subject:${genre}`));
        }
    });

    // Use event delegation for clicks on dynamically created elements.
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('.summary-btn, .book-cover')) {
            openModal(target.dataset.bookId);
        }
        const favBtn = target.closest('.fav-btn');
        if (favBtn) {
            toggleFavorite(favBtn.dataset.bookId);
        }
        const closeBtn = target.closest('.modal-close-btn');
        if (closeBtn) {
            closeModal();
        }
    });

    // Close modal if user clicks on the backdrop.
    bookModal.addEventListener('click', (e) => e.target === bookModal && closeModal());
    
    // --- INITIALIZATION ---
    // This function runs once when the page first loads.
    const init = async () => {
        loadFavorites();
        showLoading(bookList);
        renderBooks(bookList, await fetchBooks("classic literature"));
    };
    
    init();
});

