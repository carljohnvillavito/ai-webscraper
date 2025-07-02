document.addEventListener('DOMContentLoaded', () => {
    const scrapeForm = document.getElementById('scrape-form');
    const urlInput = document.getElementById('url-input');
    const extractButton = document.getElementById('extract-button');
    const loadingState = document.getElementById('loading-state');
    const resultBox = document.getElementById('result-box');
    const jsonOutput = document.getElementById('json-output');
    const downloadButton = document.getElementById('download-button');
    const refreshButton = document.getElementById('refresh-button');
    const viewRawButton = document.getElementById('view-raw-button');
    const messageToggle = document.getElementById('message-toggle');

    let currentJsonData = null;
    let currentUrl = '';
    let isRawView = false;

    // Main function to handle the scraping process
    const handleScrape = async (event) => {
        if (event) event.preventDefault();
        
        const url = urlInput.value.trim();
        if (!url) {
            showToast('error', 'Please enter a URL.');
            return;
        }
        currentUrl = url;

        // --- UI Updates: Show Loading State ---
        resultBox.classList.add('hidden');
        loadingState.classList.remove('hidden');
        extractButton.disabled = true;
        extractButton.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        messageToggle.innerHTML = ''; // Clear previous messages

        try {
            const response = await fetch(`/scrape?url=${encodeURIComponent(url)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch data from the server.');
            }

            const data = await response.json();
            currentJsonData = data;
            isRawView = false; // Reset to formatted view

            // --- UI Updates: Show Success State ---
            displayJson(currentJsonData);
            loadingState.classList.add('hidden');
            resultBox.classList.remove('hidden');
            showBootstrapMessage('success', `<strong>Success!</strong> Successfully extracted data from ${currentUrl}.`);
            
        } catch (error) {
            // --- UI Updates: Show Error State ---
            console.error('Scraping failed:', error);
            loadingState.classList.add('hidden');
            showToast('error', error.message);
            showBootstrapMessage('danger', `<strong>Error!</strong> ${error.message}`);
        } finally {
            // --- UI Updates: Reset Button ---
            extractButton.disabled = false;
            extractButton.innerHTML = '<i class="bi bi-magic"></i>';
        }
    };
    
    // Attach event listener to the form
    scrapeForm.addEventListener('submit', handleScrape);

    // --- Helper Functions for UI ---

    // Display JSON in the code block
    const displayJson = (data, raw = false) => {
        if (raw) {
            jsonOutput.textContent = JSON.stringify(data);
        } else {
            jsonOutput.textContent = JSON.stringify(data, null, 2); // Pretty print
        }
    };

    // Show SweetAlert2 toast messages
    const showToast = (icon, title) => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icon,
            title: title,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#1f2937', // bg-gray-800
            color: '#e5e7eb' // text-gray-200
        });
    };

    // Show Bootstrap-style alert messages
    const showBootstrapMessage = (type, message) => {
        const alertClass = type === 'success' ? 'bg-green-900 border-green-500 text-green-300' : 'bg-red-900 border-red-500 text-red-300';
        messageToggle.innerHTML = `
            <div class="${alertClass} border-l-4 p-4 rounded-md" role="alert">
                <p>${message}</p>
            </div>
        `;
    };

    // --- Event Listeners for Result Box Buttons ---

    // Download JSON button
    downloadButton.addEventListener('click', () => {
        if (!currentJsonData) return;
        const dataStr = JSON.stringify(currentJsonData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUrl.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0]}_data.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', 'JSON file download started.');
    });

    // Refresh button
    refreshButton.addEventListener('click', () => {
        if (!currentUrl) return;
        showToast('info', 'Refreshing data...');
        handleScrape(); // Re-run the scrape for the current URL
    });

    // View Raw/Formatted button
    viewRawButton.addEventListener('click', () => {
        if (!currentJsonData) return;
        isRawView = !isRawView;
        displayJson(currentJsonData, isRawView);
        if (isRawView) {
            viewRawButton.innerHTML = '<i class="bi bi-eye-slash"></i>';
            viewRawButton.title = "View as Formatted";
            showToast('info', 'Switched to Raw View.');
        } else {
            viewRawButton.innerHTML = '<i class="bi bi-eye"></i>';
            viewRawButton.title = "View as Raw";
            showToast('info', 'Switched to Formatted View.');
        }
    });

});
