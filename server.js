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
        const prompt = `
            You are a highly specialized web scraping AI. Your task is to analyze the provided raw HTML source code of a web page and extract a list of its primary content items (like videos, articles, products) into a structured JSON array.

            CRITICAL INSTRUCTION: Do NOT just parse the visible HTML tags. Modern websites load data via JavaScript. Your primary strategy must be to find a large JSON object embedded within a <script> tag. This data is often assigned to a JavaScript variable, for example: "var ytInitialData = {...};" or "window.__PRELOADED_STATE__ = {...}". This is the most reliable source.

            Search the ENTIRE HTML for a <script> tag containing a significant JSON structure that holds the page's main data. Parse that JSON to extract the relevant items.

            If you find a list of videos, extract fields like: "title", "videoId", "thumbnailUrl", "channelName", "viewCount", "publishedTimeText", and "videoUrl".
            
            Your response MUST be ONLY the JSON array data, without any surrounding text, explanations, or markdown formatting like \`\`\`json.
            If you absolutely cannot find a pre-loaded data script or any other structured data, return an empty array [].

            Here is the complete HTML source code:
            ---
            ${htmlContent}
            ---
        `;
        
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
