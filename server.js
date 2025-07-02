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
    You are a master web scraping AI, capable of handling both modern dynamic sites and classic static sites. Your goal is to analyze the provided HTML and extract a list of its primary content items (like videos, articles, products) into a structured JSON array.

    Your strategy should be a two-step process:

    1.  **Primary Strategy (for Dynamic Sites):** First, search the ENTIRE HTML for a large JSON object embedded in a <script> tag. This data is often assigned to a variable like "ytInitialData" or "window.__PRELOADED_STATE__". If you find this, it is the most reliable source of data. Prioritize parsing it.

    2.  **Fallback Strategy (for Static Sites):** If you CANNOT find a usable pre-loaded data script, then switch to analyzing the visible HTML content. Identify the main repeating elements (like table rows <tr> for articles, or <div>s for products) and extract their key information (title, url, score, author, etc.).

    For example, if scraping a video site, extract: "title", "videoId", "channelName", "viewCount", "videoUrl".
    If scraping a news site like Hacker News, extract: "rank", "title", "url", "score", "author", "commentCount".

    Your final output MUST be ONLY the JSON array data. Do not include any surrounding text, explanations, or markdown formatting like \`\`\`json.
    If you cannot find any structured data using either strategy, return an empty array [].

    Here is the complete HTML source code:
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
