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

    try {
        // 1. Fetch the HTML content of the target URL
        console.log(`Fetching HTML from: ${url}`);
        const { data: htmlContent } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 2. (Optional but recommended) Clean the HTML to reduce token usage
        const $ = cheerio.load(htmlContent);
        $('script, style, noscript, svg').remove(); // Remove unnecessary tags
        const bodyText = $('body').text().replace(/\s\s+/g, ' ').trim(); // Get cleaned text
        
        // Let's use the core body HTML as it's more structured than text
        const coreHtml = $('body').html();
        const MAX_LENGTH = 15000; // Set a max length to avoid overly long requests
        const truncatedHtml = coreHtml.substring(0, MAX_LENGTH);


        // 3. Construct the prompt for the AI
        const prompt = `
            You are an expert data extraction AI. Based on the following HTML source code, identify the main repeating data elements (e.g., a list of videos, products, articles) and convert them into a structured JSON array. The JSON should be clean and only contain the final array.
            
            For example, if it's a YouTube page, the result should look like:
            [{"video_title": "...", "channel_name": "...", "views": "...", "video_url": "..."}, ...]
            
            Here is the HTML content to parse:
            \`\`\`html
            ${truncatedHtml}
            \`\`\`
        `;

        // 4. Call the AI API
        const aiApiKey = '2f3f98fc-485a-457c-877f-13b8b471f484';
        const uid = crypto.randomUUID(); // Generate a unique ID for the request
        const aiApiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro`;

        console.log('Sending prompt to AI...');
        const aiResponse = await axios.get(aiApiUrl, {
            params: {
                ask: prompt,
                uid: uid,
                imageUrl: '',
                apikey: aiApiKey
            }
        });
        
        // 5. The AI's response is a string, which we need to parse into JSON
        let jsonResult;
        try {
            // The actual JSON is inside the 'response' property of the AI's return value
            const responseString = aiResponse.data.response;
            console.log('AI Raw Response:', responseString);
            
            // Clean the response string - AI might wrap it in markdown
            const cleanedResponse = responseString.replace(/^```json\n|```$/g, '').trim();
            jsonResult = JSON.parse(cleanedResponse);

        } catch (parseError) {
            console.error('Failed to parse AI response into JSON:', parseError);
            // If parsing fails, send the raw string back for debugging
            return res.status(500).json({ 
                error: 'AI returned a non-JSON response.',
                rawResponse: aiResponse.data.response 
            });
        }
        
        // 6. Send the final JSON back to the client
        res.status(200).json(jsonResult);

    } catch (error) {
        console.error('An error occurred:', error.message);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(500).json({ error: `Error fetching the URL: ${error.response.status} ${error.response.statusText}` });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(500).json({ error: 'No response received from the target URL. It might be down or blocking requests.' });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).json({ error: `An internal error occurred: ${error.message}` });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
