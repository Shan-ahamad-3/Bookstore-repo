// --- JAVASCRIPT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT SELECTORS (No Changes Here) ---
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
    let favorites = [];

    // --- API & CORE FUNCTIONS (No Changes Here) ---
    const callGemini = async (prompt, retryCount = 3, delay = 1000) => { /* ...
        code hidden for brevity ... */ };
    window.generateAISummary = async (button, title, authors) => { /* ... code hidden
        for brevity ... */ };
    window.generateDiscussionQuestions = async (button, title, authors) => { /* ...
        code hidden for brevity ... */ };
    const fetchBooks = async (query, maxResults = 40) => { /* ... code hidden for
        brevity ... */ };
    const renderBooks = (container, books) => { /* ... code hidden for brevity ...
    */ };
    window.openModal = async (bookId) => { /* ... code hidden for brevity ... */ };
    const closeModal = () => { /* ... code hidden for brevity ... */ };
    const showLoading = (container) => { container.innerHTML = '<div class="loader col-span-full"></div>'; };
    const showView = (viewId) => {
        allViews.forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
    };
    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        showView('home-view');
        showLoading(bookList);
        renderBooks(bookList, await fetchBooks(query));
    };
    const loadFavorites = () => { favorites = JSON.parse(localStorage.getItem('bookNookFavorites')) || []; };
    const saveFavorites = () => { localStorage.setItem('bookNookFavorites', JSON.stringify(favorites)); };
    const toggleFavorite = async (bookId) => { /* ... code hidden for brevity ...
    */ };
    const displayFavorites = () => { /* ... code hidden for brevity ... */ };
    const displayAuthorsPicks = async () => {
        showLoading(authorsPickList);
        renderBooks(authorsPickList, await fetchBooks("Pulitzer Prize for Fiction"));
    };

    // --- NEW FUNCTION TO RESET THE HOME PAGE ---
    /**
     * Shows the home view and loads the default set of books.
     */
    const resetToHome = async () => {
        showView('home-view');
        showLoading(bookList);
        // We also clear the search input for a full reset
        searchInput.value = '';
        renderBooks(bookList, await fetchBooks("classic literature"));
    };


    // --- EVENT LISTENERS (MODIFIED) ---

    // Handle clicks on navigation links.
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('data-view');

            // *** MODIFICATION START ***
            // If the clicked link is the home link, run the reset function.
            if (viewId === 'home-view') {
                resetToHome();
            } else {
                // Otherwise, perform the original actions.
                showView(viewId);
                if (viewId === 'favorites-view') displayFavorites();
                if (viewId === 'authors-pick-view') displayAuthorsPicks();
            }
            // *** MODIFICATION END ***
        });
    });

    // Handle click on the logo to go home.
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        // *** MODIFICATION ***
        // Call the new reset function instead of just showing the view.
        resetToHome();
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
    const init = () => {
        loadFavorites();
        // *** MODIFICATION ***
        // Use the new reset function to initialize the app.
        resetToHome();
    };

    init();
});
