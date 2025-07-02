require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.static('public')); // Serve static files from the 'public' directory
app.use(express.json()); // To parse JSON bodies

// --- The Core Scraping and AI Processing Route ---
app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Prepend 'https://' if no protocol is present
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    try {
        // Step 1: Fetch the HTML content of the target URL
        console.log(`Scraping URL: ${url}`);
        const response = await axios.get(url, {
            headers: {
                // Use a common user-agent to avoid being blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const htmlContent = response.data;

        // Step 2: Prepare the prompt for the Gemini AI
        // We give it clear instructions and a role.
        // Inside the app.get('/scrape', ...) route in server.js

// ... after fetching htmlContent ...

// Step 2: Prepare the prompt for the Gemini AI
// NEW, SMARTER PROMPT
const prompt = `
    You are an expert web scraping AI. Your task is to analyze the provided HTML source code and extract meaningful, structured data into a JSON format.
    The user wants to scrape the main content of the page.

    IMPORTANT: Modern websites often load data with JavaScript. Look for a large JSON object embedded within a <script> tag, especially one that looks like initial page data or state. This is often the most reliable source of data.

    If you find such a JSON object inside a script, prioritize extracting data from it.
    If not, analyze the HTML for key repeating elements (like a list of products, articles, videos, or listings) and extract their main attributes.

    For example, for a list of videos, extract title, channel, views, and URL for each.
    For an e-commerce site, extract product name, price, and image URL.

    Your response MUST be ONLY the JSON data, without any explanations, introductory text, or markdown formatting like \`\`\`json.
    If you cannot find any structured data in either the script tags or the HTML body, return an empty array [].

    Here is the HTML source code:
    ---
    ${htmlContent}
    ---
`;

// ... the rest of the file stays the same ...
        // Step 3: Call the Google Gemini API
        console.log('Sending data to Gemini AI...');
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const geminiResponse = await axios.post(geminiApiUrl, {
            contents: [{
                parts: [{ text: prompt }]
            }],
            // Safety settings to allow a wider range of content
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ]
        });

        // Step 4: Extract and clean the JSON response from the AI
        let aiResultText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // Clean the response: remove markdown backticks and trim whitespace
        aiResultText = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse the cleaned text into a JSON object
        const jsonData = JSON.parse(aiResultText);
        
        console.log('Successfully extracted JSON data.');
        res.json(jsonData);

    } catch (error) {
        console.error('An error occurred:', error.message);
        let errorMessage = 'An internal server error occurred.';
        if (error.response) {
            // Error from axios request (scraping or AI API)
            console.error('Error data:', error.response.data);
            console.error('Error status:', error.response.status);
            errorMessage = error.response.data.error?.message || `Failed to process the request. Status: ${error.response.status}`;
        } else if (error.request) {
            // The request was made but no response was received
            errorMessage = 'Could not connect to the target URL or AI service.';
        } else {
             // Something happened in setting up the request that triggered an Error
             errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
