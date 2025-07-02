require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio'); // We keep it, just in case we need it for minor tweaks later
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.get('/scrape', async (req, res) => {
    let { url } = req.query;

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
        sendStatus('URL is required.', 'error');
        return res.end();
    }

    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    let browser = null;
    try {
        sendStatus('Launching optimized headless browser...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--no-zygote',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

        sendStatus(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        sendStatus('Page rendered. Extracting full HTML.');
        const renderedHtml = await page.content(); // Get the complete rendered HTML
        await browser.close();
        browser = null;

        // --- THE FIX: We are NO LONGER removing script tags with Cheerio ---
        // Instead, we are giving the full, rich HTML to the AI.
        
        if (!renderedHtml || renderedHtml.trim().length < 100) {
             throw new Error("Puppeteer did not return meaningful HTML content.");
        }

        // --- RE-INSTATED THE SMARTEST AI PROMPT ---
        const prompt = `You are an autonomous data extraction AI. Your objective is to analyze the raw HTML of any given webpage and intelligently convert its main content into a structured JSON array.

YOUR PROCESS:
1.  **Prioritize Script Tag Analysis:** Your first and most important strategy is to find a large JSON object embedded within a \`<script>\` tag. Modern dynamic websites (like YouTube) often preload all their data this way in variables like "ytInitialData", "window.__PRELOADED_STATE__", or similar. This is the most accurate and rich source of data. If you find it, use it as your primary source.
2.  **Fallback to HTML Structure Analysis:** If, and only if, you cannot find a comprehensive JSON object in a script tag, then pivot to analyzing the rendered HTML structure. Identify the primary, repeating data entity on the page (e.g., a list of articles, products, videos, search results, etc.).
3.  **Create JSON Objects:** For each repeating item you identify (whether from the script JSON or the HTML tags), create a single JSON object.
4.  **Use Intelligent Keys:** The keys for the JSON object must be logical, camelCased, and self-descriptive, inferred directly from the data's meaning. For example, use keys like "title", "channelName", "viewCount", "videoUrl", "publishedTime".
5.  **Extract All Relevant Data:** Extract all relevant and available information for each item (e.g., URLs, thumbnails, descriptions, prices, authors, etc.).

OUTPUT REQUIREMENTS:
- Your entire response MUST be the final JSON array.
- Do NOT include any explanations, comments, or markdown formatting like \`\`\`json.
- If no structured list of items can be logically extracted, return an empty array [].

Analyze the following full HTML content:
---
${renderedHtml}
---`;
        
        sendStatus('Sending full HTML to AI for intelligent analysis...');
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const geminiResponse = await axios.post(geminiApiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" },
            ]
        });

        if (!geminiResponse.data.candidates || geminiResponse.data.candidates.length === 0) {
            throw new Error("AI analysis failed. The model did not return a valid response.");
        }
        
        sendStatus('AI analysis complete. Formatting final result...');
        let aiResultText = geminiResponse.data.candidates[0].content.parts[0].text;
        aiResultText = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();

        const finalJsonData = JSON.parse(aiResultText);
        const sseFormattedResult = `event: result\ndata: ${JSON.stringify(finalJsonData)}\n\n`;
        res.write(sseFormattedResult);
        
    } catch (error) {
        console.error('An error occurred during the scraping process:', error.message);
        let errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        sendStatus(errorMessage, 'error');
    } finally {
        if (browser) {
            await browser.close();
        }
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
