const puppeteer = require('puppeteer');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const express = require('express');

const IMAGE_PATH = './radar-latest.png';
const PORT = process.env.PORT || 10000;
const app = express();

async function fetchRadar() {
    try {
        console.log('Fetching radar image...');
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ]
        });

        const page = await browser.newPage();

        // Go directly to radar page (no cookie banner handling)
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait a few seconds to ensure the radar map is fully loaded
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Take a screenshot
        const screenshotBuffer = await page.screenshot();

        // Add timestamp overlay
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';
        const timestamp = new Date().toLocaleString('en-GB', {
            timeZone: 'Europe/Athens',
            hour12: true
        });
        ctx.fillText(timestamp, 10, 30);

        // Save image as radar-latest.png
        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Run once at startup
fetchRadar();

// Schedule to run every 10 minutes
setInterval(fetchRadar, 10 * 60 * 1000);

// Minimal Express server
app.get('/radar-latest.png', (req, res) => {
    res.sendFile(__dirname + '/radar-latest.png');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
