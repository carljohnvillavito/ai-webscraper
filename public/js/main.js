document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const scrapeBtn = document.getElementById('scrapeBtn');
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('resultContainer');
    const jsonResult = document.getElementById('jsonResult');
    const refreshBtn = document.getElementById('refreshBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const rawBtn = document.getElementById('rawBtn');

    let rawJsonData = ''; // To store the raw JSON string for download/toggle
    let isRawView = false; // To toggle between pretty and raw view

    const handleScrape = async () => {
        const url = urlInput.value.trim();
        if (!url) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Please enter a URL to scrape!',
                background: '#1E293B',
                color: '#E2E8F0'
            });
            return;
        }

        // --- UI State: Start Loading ---
        scrapeBtn.disabled = true;
        scrapeBtn.innerHTML = `<i class="bi bi-hourglass-split"></i>`;
        urlInput.disabled = true;
        loader.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        jsonResult.innerHTML = '';

        try {
            const response = await fetch(`/scrape?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            if (!response.ok || data.success === false) {
                 throw new Error(data.message || 'Failed to get a valid response from the server.');
            }

            // The server now sends the JSON directly
            rawJsonData = JSON.stringify(data, null, 2); // Pretty print for initial display
            
            // --- UI State: Show Success ---
            displayJson(rawJsonData); // Display the pretty-printed JSON
            resultContainer.classList.remove('hidden');

        } catch (error) {
            console.error('Scraping failed:', error);
            Swal.fire({
                icon: 'error',
                title: 'Scraping Failed',
                text: error.message,
                background: '#1E293B',
                color: '#E2E8F0'
            });
        } finally {
            // --- UI State: Stop Loading ---
            loader.classList.add('hidden');
            scrapeBtn.disabled = false;
            scrapeBtn.innerHTML = `<i class="bi bi-magic text-xl"></i><span class="ml-2 hidden md:inline">Extract</span>`;
            urlInput.disabled = false;
        }
    };

    const displayJson = (jsonData) => {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = jsonData;
        pre.appendChild(code);
        jsonResult.innerHTML = ''; // Clear previous content
        jsonResult.appendChild(pre);
        isRawView = false;
        rawBtn.innerHTML = '<i class="bi bi-file-earmark-code"></i>';
        rawBtn.title = 'View as Raw';
    };

    const displayRaw = (jsonData) => {
        const textArea = document.createElement('textarea');
        textArea.className = 'w-full h-full bg-slate-900 text-slate-300 border-0 focus:ring-0 p-4 rounded-md';
        textArea.style.height = '60vh';
        textArea.textContent = JSON.stringify(JSON.parse(jsonData)); // Un-prettify for raw view
        jsonResult.innerHTML = '';
        jsonResult.appendChild(textArea);
        isRawView = true;
        rawBtn.innerHTML = '<i class="bi bi-file-earmark-text"></i>';
        rawBtn.title = 'View as Pretty';
    };

    scrapeBtn.addEventListener('click', handleScrape);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleScrape();
        }
    });

    refreshBtn.addEventListener('click', handleScrape);

    downloadBtn.addEventListener('click', () => {
        if (!rawJsonData) return;
        const blob = new Blob([rawJsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scraped_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    rawBtn.addEventListener('click', () => {
        if (!rawJsonData) return;
        if (isRawView) {
            displayJson(rawJsonData);
        } else {
            displayRaw(rawJsonData);
        }
    });
});
