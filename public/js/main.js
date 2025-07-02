
// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const scrapeForm = document.getElementById('scrape-form');
    const urlInput = document.getElementById('url-input');
    const extractButton = document.getElementById('extract-button');
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('result-container');
    const jsonResultBox = document.getElementById('json-result-box');
    const welcomeMessage = document.getElementById('welcome-message');
    
    // Action Buttons
    const downloadButton = document.getElementById('download-button');
    const refreshButton = document.getElementById('refresh-button');
    const rawViewButton = document.getElementById('raw-view-button');

    // --- State Management ---
    let currentJsonData = null;
    let isRawView = false;
    
    // --- Event Listeners ---
    scrapeForm.addEventListener('submit', handleScrape);
    downloadButton.addEventListener('click', handleDownload);
    refreshButton.addEventListener('click', () => handleScrape(new Event('submit')));
    rawViewButton.addEventListener('click', toggleRawView);
    
    // --- Main Scraping Logic ---
    async function handleScrape(event) {
        event.preventDefault();
        const url = urlInput.value.trim();
        
        if (!url) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Please enter a URL to scrape!',
                background: '#1f2937',
                color: '#e5e7eb'
            });
            return;
        }

        // --- UI Updates for Loading ---
        showLoader(true);
        resultContainer.classList.add('hidden');
        welcomeMessage.classList.add('hidden');
        extractButton.disabled = true;
        extractButton.innerHTML = `<i class="bi bi-hourglass-split"></i>`;

        try {
            const response = await fetch(`/scrape?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (!response.ok) {
                // Handle errors from the backend (including AI errors)
                throw new Error(data.error || 'An unknown error occurred.');
            }
            
            currentJsonData = data;
            displayJson(currentJsonData);
            resultContainer.classList.remove('hidden');

        } catch (error) {
            console.error('Scraping failed:', error);
            Swal.fire({
                icon: 'error',
                title: 'Scraping Failed',
                text: error.message,
                background: '#1f2937',
                color: '#e5e7eb'
            });
            welcomeMessage.classList.remove('hidden'); // Show instructions again
        } finally {
            // --- UI Cleanup ---
            showLoader(false);
            extractButton.disabled = false;
            extractButton.innerHTML = `<i class="bi bi-magic"></i>`;
        }
    }

    // --- UI Helper Functions ---
    function showLoader(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
    }

    function displayJson(data) {
        const format = isRawView ? undefined : 2; // 2 spaces for pretty print
        jsonResultBox.textContent = JSON.stringify(data, null, format);
    }
    
    // --- Action Button Handlers ---
    function toggleRawView() {
        isRawView = !isRawView;
        if (currentJsonData) {
            displayJson(currentJsonData);
        }
        rawViewButton.classList.toggle('text-purple-400', isRawView);
    }

    function handleDownload() {
        if (!currentJsonData) return;

        const jsonDataString = JSON.stringify(currentJsonData, null, 2);
        const blob = new Blob([jsonDataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        const domain = urlInput.value.split('/')[0] || 'scraped_data';
        a.download = `${domain.replace(/\./g, '_')}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
