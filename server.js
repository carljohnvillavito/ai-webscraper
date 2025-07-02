// server.js - Final version with paste.gg workaround

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required.' });
    }

    if (!/^(https?:\/\/)/i.test(url)) {
        url = 'https://' + url;
    }

    let htmlContent;
    try {
        // Step 1: Fetch the HTML from the target URL
        console.log(`Fetching HTML from: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        htmlContent = response.data;
    } catch (error) {
        console.error(`Error fetching target URL ${url}:`, error.message);
        return res.status(500).json({ error: `Failed to fetch content from the target URL. It may be down or blocking requests.` });
    }

    try {
        // Step 2: Clean the HTML
        const $ = cheerio.load(htmlContent);
        $('script, style, noscript, svg, footer, header, nav').remove();
        const truncatedHtml = $('body').html().substring(0, 20000); // Increased limit for pastebin

        // --- WORKAROUND STEP 3: Upload HTML to a pastebin service ---
        console.log('Uploading cleaned HTML to paste.gg...');
        const pasteResponse = await axios.post('https://api.paste.gg/v1/pastes', {
            // No name or description needed, just the content
            files: [{
                name: 'scrape.html', // Optional name
                content: {
                    format: 'text',
                    value: truncatedHtml
                }
            }]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Check if paste was created successfully
        if (pasteResponse.data.status !== 'success' || !pasteResponse.data.result) {
            throw new Error('Failed to upload HTML to paste.gg');
        }

        const pasteId = pasteResponse.data.result.id;
        const rawPasteUrl = `https://paste.gg/p/anonymous/${pasteId}/raw`;
        console.log(`HTML uploaded successfully. Raw URL: ${rawPasteUrl}`);
        
        // --- WORKAROUND STEP 4: Create a new, short prompt for the AI ---
        const prompt = `
            You are an expert data extraction AI. Your task is to fetch the HTML source code from the following URL: ${rawPasteUrl}. After fetching it, identify the main, repeating data elements (like a list of videos) and convert these elements into a structured JSON array. The final output must be ONLY the JSON array itself, without any extra text or explanations.

            For example, for a YouTube page, the desired output format is:
            [{"video_title": "...", "channel_name": "...", "views": "...", "video_url": "..."}, ...]
        `;
        
        // Step 5: Call the AI API using a GET request (as originally intended)
        const aiApiKey = '2f3f98fc-485a-457c-877f-13b8b471f484';
        const uid = crypto.randomUUID();
        const aiApiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro`;

        console.log('Sending short prompt to AI via GET request...');
        const aiResponse = await axios.get(aiApiUrl, {
            params: {
                ask: prompt,
                uid: uid,
                imageUrl: '',
                apikey: aiApiKey
            }
        });

        // Step 6: Parse the AI's response
        const responseString = aiResponse.data.response;
        console.log('AI Raw Response:', responseString);
        
        const cleanedResponse = responseString.replace(/^```json\n|```$/g, '').trim();
        const jsonResult = JSON.parse(cleanedResponse);

        res.status(200).json(jsonResult);

    } catch (error) {
        console.error('An error occurred during processing:', error.message);
        if (error.response) {
            return res.status(500).json({ 
                error: `An API returned an error: ${error.response.status} ${error.response.statusText}`,
                rawResponse: error.response.data
            });
        }
        return res.status(500).json({ 
            error: 'An unexpected error occurred.',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
