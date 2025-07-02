require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
// Cheerio is no longer needed and has been removed.

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// The final, robust scraping route
app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    // Setup for Server-Sent Events (SSE)
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const sendStatus = (statusMessage, event = 'status') => {
        const sseFormattedMessage = `event: ${event}\ndata: ${JSON.stringify({ message: statusMessage })}\n\n`;
        res.write(sseFormattedMessage);
    };

    if (!url) {
        sendStatus('URL is required', 'error');
        return res.end();
    }

    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    try {
        // Stage 1: Fetching FULL HTML
        sendStatus(`Connecting to ${url}...`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const htmlContent = response.data; // We are using the FULL HTML content
        sendStatus('Full HTML page received successfully.');

        // Stage 2: AI Processing with the "Surgical Strike" Prompt
        // This new prompt is highly specific for dynamic sites.
        // Inside the app.get('/scrape', ...) route in server.js

// ... after fetching htmlContent ...

// Stage 2: AI Processing with the "Master Prompt"
const prompt = `
// Inside the app.get('/scrape', ...) route in server.js

// ... after fetching htmlContent ...

// Stage 2: AI Processing with the "Universal Analyst" Prompt

const prompt = `You are an autonomous data extraction AI. Your objective is to analyze the raw HTML of any given webpage and intelligently convert its main content into a structured JSON array.

    YOUR PROCESS:
    1.  First, determine the most effective strategy for this specific page. Try to locate a large JSON object embedded in a <script> tag (e.g., inside a "window.__PRELOADED_STATE__" or "ytInitialData" variable), as this is often the most accurate source for dynamic sites.
    2.  If a pre-loaded data script is not found, pivot to analyzing the rendered HTML structure. Identify the primary, repeating data entity on the page (e.g., a list of articles, products, videos, search results, etc.).
    3.  For each repeating item you identify, create a JSON object.
    4.  The keys for the JSON object should be logical and self-descriptive, inferred directly from the data's meaning. For example, if you see a product name, use a key like "productName" or "title". If you see a price, use "price". If you see a link, use "url". Do not use generic keys like "item1" or "value2".
    5.  Extract all relevant and available information for each item.

    OUTPUT REQUIREMENTS:
    - Your entire response MUST be the final JSON array.
    - Do NOT include any explanations, comments, or markdown formatting like \`\`\`json.
    - If no structured list of items can be logically extracted from the page, return an empty array [].

    Analyze the following HTML content:
    ---
    ${htmlContent}
    ---
`;

// ... the rest of the file stays the same ...
        
        sendStatus('Sending full HTML to AI for surgical analysis...');
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const geminiResponse = await axios.post(geminiApiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ]
        });

        sendStatus('AI analysis complete. Formatting final result...');
        let aiResultText = geminiResponse.data.candidates[0].content.parts[0].text;
        aiResultText = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();

        const finalJsonData = JSON.parse(aiResultText);
        const sseFormattedResult = `event: result\ndata: ${JSON.stringify(finalJsonData)}\n\n`;
        res.write(sseFormattedResult);
        
    } catch (error) {
        console.error('An error occurred during scraping stream:', error.message);
        let errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        sendStatus(errorMessage, 'error');
    } finally {
        res.end(); // Close the connection
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
