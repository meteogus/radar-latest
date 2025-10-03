const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

// Serve all files in project folder
app.use(express.static(__dirname));

async function fetchRadar() {
    try {
        console.log('Fetching radar image...');

        const browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ]
        });

        const page = await browser.newPage();
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'networkidle2' });

        // Click cookie banner if it appears
        try {
            await page.click('#cookie-banner button, .cookie-accept, [aria-label="Accept cookies"]', { timeout: 3000 });
        } catch (err) {
            // Ignore if cookie banner not found
        }

        const screenshotBuffer = await page.screenshot();

        // Load image in canvas
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        // Timestamp in Athens local time
        const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens' });

        // Draw timestamp top-left, yellow with black outline
        ctx.font = '24px sans-serif';
        ctx.fillStyle = 'yellow';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(timestamp, 10, 30);
        ctx.fillText(timestamp, 10, 30);

        // Save PNG
        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Fetch every 5 minutes
cron.schedule('*/5 * * * *', fetchRadar);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // fetch immediately on start
});
