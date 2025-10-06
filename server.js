const puppeteer = require('puppeteer');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const express = require('express');

const IMAGE_PATH = './radar-latest.png';
const app = express();
const PORT = process.env.PORT || 10000;

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

        // Set cookie first
        await page.setCookie({
            name: 'noa_radar_cookie',
            value: 'accepted',
            domain: '.meteo.noa.gr'
        });

        // Go to radar page
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait until cookie banner is visible (if exists), then click Accept
        try {
            await page.waitForSelector('.cc-compliance .cc-btn', { timeout: 10000 });
            await page.click('.cc-compliance .cc-btn');
            console.log('Cookie banner clicked.');
        } catch {
            console.log('No cookie banner visible.');
        }

        // Wait a moment for map to load
        await new Promise(resolve => setTimeout(resolve, 3000)); // fixed waitForTimeout issue

        const screenshotBuffer = await page.screenshot();

        // Add timestamp
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';
        const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens', hour12: true });
        ctx.fillText(timestamp, 10, 30);

        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Run fetchRadar once on start
fetchRadar();

// Optional: schedule repeated fetching every 10 minutes
setInterval(fetchRadar, 10 * 60 * 1000); // every 10 minutes

// Minimal server (no index.html needed)
app.use(express.static(__dirname));

// Cron job endpoint
app.get('/fetch', async (req, res) => {
    try {
        await fetchRadar();
        res.send('Radar fetched successfully');
    } catch (err) {
        res.status(500).send('Error fetching radar');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

