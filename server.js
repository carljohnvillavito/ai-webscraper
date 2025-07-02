require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio'); // <-- Import cheerio

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// --- The NEW Streaming Scrape Route ---
app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    // --- Setup for Server-Sent Events (SSE) ---
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Helper function to send status updates to the client
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
        // --- Stage 1: Fetching HTML ---
        sendStatus(`Connecting to ${url}...`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const htmlContent = response.data;
        sendStatus('HTML content received successfully.');

        // --- Stage 2: Parsing with Cheerio ---
        sendStatus('Parsing HTML content to isolate body...');
        const $ = cheerio.load(htmlContent);
        const bodyContent = $('body').html(); // <-- Get HTML of the body tag only

        if (!bodyContent || bodyContent.trim().length === 0) {
             throw new Error("Could not find the <body> content of the page.");
        }

        // --- Stage 3: AI Processing ---
        const prompt = `
            You are an expert web scraping AI. Your task is to analyze the provided HTML body content and extract meaningful, structured data from it into a JSON format.
            Focus on the main repeating elements on the page (like products, articles, videos, or listings).

            For example, if it's a list of videos, extract title, channel, views, and URL for each.
            If it's an e-commerce site, extract product name, price, and image URL.

            Your response MUST be ONLY the JSON data, without any explanations, introductory text, or markdown formatting like \`\`\`json.
            If you cannot find any structured data, return an empty array [].

            Here is the HTML body content:
            ---
            ${bodyContent}
            ---
        `;
        sendStatus('Sending extracted content to AI for analysis...');
        
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

        sendStatus('AI analysis complete. Processing final result...');
        let aiResultText = geminiResponse.data.candidates[0].content.parts[0].text;
        aiResultText = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();

        // --- Final Stage: Sending Result ---
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
