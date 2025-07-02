// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const crypto = require('crypto'); // For generating random UIDs

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// The main scraping route
app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required.' });
    }

    // Prepend 'https://' if the URL doesn't have a protocol
    if (!/^(https?:\/\/)/i.test(url)) {
        url = 'https://' + url;
    }

    let htmlContent;
    try {
        // Step 1: Fetch the HTML content of the target URL
        console.log(`Fetching HTML from: ${url}`);
        const response = await axios.get(url, {
            headers: {
                // Using a common browser user-agent can help avoid being blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        htmlContent = response.data;
    } catch (error) {
        console.error(`Error fetching target URL ${url}:`, error.message);
        return res.status(500).json({ error: `Failed to fetch content from the target URL. It may be down or blocking requests.` });
    }

    try {
        // Step 2: Clean and truncate the HTML to reduce token usage and complexity
        const $ = cheerio.load(htmlContent);
        $('script, style, noscript, svg, footer, header, nav').remove(); // Remove more non-essential tags
        const coreHtml = $('body').html();
        
        // A generous max length to avoid overly long requests that might be rejected
        const MAX_LENGTH = 15000; 
        const truncatedHtml = coreHtml.substring(0, MAX_LENGTH);

        // Step 3: Construct the prompt for the AI
        const prompt = `
            You are an expert data extraction AI. Your task is to analyze the provided HTML source code and identify the main, repeating data elements (like a list of videos, products, or articles). Convert these elements into a structured JSON array. The final output must be ONLY the JSON array itself, without any extra text, explanations, or markdown formatting like \`\`\`json.

            For example, for a YouTube page, the desired output format is:
            [{"video_title": "...", "channel_name": "...", "views": "...", "video_url": "..."}, ...]
            
            Now, parse the following HTML content:
            \`\`\`html
            ${truncatedHtml}
            \`\`\`
        `;

        // Step 4: Call the AI API using a POST request to handle the large HTML payload
        const aiApiKey = '2f3f98fc-485a-457c-877f-13b8b471f484';
        const uid = crypto.randomUUID();
        const aiApiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro`;

        console.log('Sending prompt to AI via POST request...');
        
        // --- THE FIX: Using axios.post ---
        // We send the parameters in the request body instead of the URL
        const aiResponse = await axios.post(aiApiUrl, {
            ask: prompt,
            uid: uid,
            imageUrl: '',
            apikey: aiApiKey
        });
        // --- END OF FIX ---

        // Step 5: Parse the AI's response
        // The actual content is inside the 'response' property of the AI's return value
        const responseString = aiResponse.data.response;
        console.log('AI Raw Response:', responseString);
        
        // Clean the response string - AI might wrap it in markdown even if instructed not to
        const cleanedResponse = responseString.replace(/^```json\n|```$/g, '').trim();
        const jsonResult = JSON.parse(cleanedResponse);

        // Step 6: Send the final JSON back to the client
        res.status(200).json(jsonResult);

    } catch (error) {
        console.error('An error occurred during AI processing or JSON parsing:', error.message);
        
        if (error.response) {
            // This will catch errors from the AI API specifically (e.g., bad API key, server error)
            return res.status(500).json({ 
                error: `The AI API returned an error: ${error.response.status} ${error.response.statusText}`,
                rawResponse: error.response.data // Forward the AI's error message
            });
        }
        
        // This will catch other errors, like failing to parse the JSON from the AI
        return res.status(500).json({ 
            error: 'An error occurred while processing the request with the AI.',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
