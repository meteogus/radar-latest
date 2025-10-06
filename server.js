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

        // Try to skip cookies by setting a persistent cookie before visiting
        await page.setCookie({
            name: 'cookieconsent_status',
            value: 'allow',
            domain: '.meteo.noa.gr'
        });

        // Visit the radar page directly
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait a moment for map to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot
        const screenshotBuffer = await page.screenshot();

        // Add timestamp overlay
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

// Fetch radar immediately and every 10 minutes
fetchRadar();
setInterval(fetchRadar, 10 * 60 * 1000);

// Serve static files (so radar-latest.png can be accessed)
app.use(express.static(__dirname));

// Root route (used by cron-job.org just to ping)
app.get('/', (req, res) => {
    res.send('Radar service is running ✅');
});

// Optional manual refresh route (you can use this in Cron job)
app.get('/refresh', async (req, res) => {
    await fetchRadar();
    res.send('Radar refreshed successfully ✅');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
