require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('/scrape', async (req, res) => {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'URL parameter is required.' });
    }

    // Prepend http:// if no protocol is specified
    if (!/^https?:\/\//i.test(url)) {
        url = 'http://' + url;
    }

    try {
        // 1. Fetch the HTML content from the user-provided URL
        console.log(`Fetching HTML from: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const htmlContent = response.data;

        // 2. Prepare the prompt for the AI
        // We refine the prompt to be more specific and get better results.
        const prompt = `
            You are an expert data extraction AI. Your task is to analyze the following HTML content and extract the primary, repeating data items into a structured JSON array.
            
            For a page listing products, extract products. For a page like YouTube, extract videos. For a news site, extract articles.
            
            Based on the content, create a JSON object for each item with clear and relevant fields like "title", "link", "description", "imageUrl", "price", "author", etc.
            
            IMPORTANT: Your entire response must be ONLY the raw JSON array. Do not include any explanations, comments, or markdown formatting like \`\`\`json.
            
            Here is the HTML content:
            \`\`\`html
            ${htmlContent.substring(0, 30000)} 
            \`\`\`
        `;
        // We substring the HTML to avoid exceeding token limits for very large pages.

        console.log('Sending prompt to AI...');

        // 3. Call the Gemini API
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const aiResponse = await axios.post(geminiApiUrl, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                // Ensure the output is JSON
                responseMimeType: "application/json",
            }
        });

        // 4. Extract and clean the JSON from the AI's response
        let jsonText = aiResponse.data.candidates[0].content.parts[0].text;
        
        console.log('AI response received.');
        
        // The AI should now be correctly outputting JSON due to responseMimeType,
        // but we keep this as a fallback.
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/```$/, '');

        // 5. Send the structured JSON back to the client
        res.setHeader('Content-Type', 'application/json');
        res.send(jsonText); // Send the raw JSON string

    } catch (error) {
        console.error('Error during scraping process:', error.message);
        let errorMessage = 'An error occurred during the scraping process.';
        if (error.response) {
            // Error from axios request (to target URL or AI)
            console.error('Error data:', error.response.data);
            console.error('Error status:', error.response.status);
            errorMessage = error.response.data.error?.message || `Failed to fetch or process the URL. Status: ${error.response.status}`;
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
