document.addEventListener('DOMContentLoaded', () => {
    const scrapeForm = document.getElementById('scrape-form');
    const urlInput = document.getElementById('url-input');
    const extractButton = document.getElementById('extract-button');
    const loadingState = document.getElementById('loading-state');
    const loadingLog = document.getElementById('loading-log');
    const resultBox = document.getElementById('result-box');
    const jsonOutput = document.getElementById('json-output');
    const downloadButton = document.getElementById('download-button');
    const refreshButton = document.getElementById('refresh-button');
    const viewRawButton = document.getElementById('view-raw-button');
    const messageToggle = document.getElementById('message-toggle');

    let currentJsonData = null;
    let currentUrl = '';
    let isRawView = false;
    let eventSource = null;

    // --- NEW: A dedicated function for the main scraping logic ---
    const startScrapeProcess = (urlToScrape) => {
        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }
        
        currentUrl = urlToScrape;

        // UI Updates: Show Loading State
        resultBox.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadingLog.textContent = 'Initializing...';
        extractButton.disabled = true;
        extractButton.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        messageToggle.innerHTML = '';

        // Start Server-Sent Events (SSE) Connection
        eventSource = new EventSource(`/scrape?url=${encodeURIComponent(urlToScrape)}`);

        eventSource.addEventListener('status', (e) => {
            const data = JSON.parse(e.data);
            console.log('Status Update:', data.message);
            loadingLog.textContent = data.message;
        });

        eventSource.addEventListener('result', (e) => {
            currentJsonData = JSON.parse(e.data);
            isRawView = false;

            displayJson(currentJsonData);
            loadingState.classList.add('hidden');
            resultBox.classList.remove('hidden');
            showBootstrapMessage('success', `<strong>Success!</strong> Successfully extracted data from ${currentUrl}.`);
            
            eventSource.close();
            resetButton();
        });

        eventSource.addEventListener('error', (e) => {
            if (e.data) {
                const errorData = JSON.parse(e.data);
                console.error('Server-side error:', errorData.message);
                showToast('error', errorData.message);
                showBootstrapMessage('danger', `<strong>Error!</strong> ${errorData.message}`);
            } else {
                 console.error('Connection to stream failed.');
                 showToast('error', 'Could not connect to the server.');
                 showBootstrapMessage('danger', `<strong>Error!</strong> Connection failed.`);
            }

            loadingState.classList.add('hidden');
            eventSource.close();
            resetButton();
        });
    };

    // --- NEW: A dedicated handler for the form submission ---
    const handleFormSubmit = (event) => {
        event.preventDefault(); // <-- This is the crucial part!
        const url = urlInput.value.trim();
        if (!url) {
            showToast('error', 'Please enter a URL.');
            return;
        }
        startScrapeProcess(url);
    };
    
    // Attach the new handler to the form's submit event
    scrapeForm.addEventListener('submit', handleFormSubmit);

    const resetButton = () => {
        extractButton.disabled = false;
        extractButton.innerHTML = '<i class="bi bi-magic"></i>';
    };

    // Helper Functions (no changes below this line)
    // ... (the rest of the file is the same)

    const displayJson = (data, raw = false) => {
        if (raw) {
            jsonOutput.textContent = JSON.stringify(data);
        } else {
            jsonOutput.textContent = JSON.stringify(data, null, 2);
        }
    };

    const showToast = (icon, title) => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icon,
            title: title,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#1f2937',
            color: '#e5e7eb'
        });
    };

    const showBootstrapMessage = (type, message) => {
        const alertClass = type === 'success' ? 'bg-green-900 border-green-500 text-green-300' : 'bg-red-900 border-red-500 text-red-300';
        messageToggle.innerHTML = `
            <div class="${alertClass} border-l-4 p-4 rounded-md" role="alert">
                <p>${message}</p>
            </div>
        `;
    };

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

    // MODIFIED: The refresh button now calls the new logic function directly
    refreshButton.addEventListener('click', () => {
        if (!currentUrl) return;
        showToast('info', 'Refreshing data...');
        startScrapeProcess(currentUrl); // <-- Using the new function
    });


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
