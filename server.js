const puppeteer = require('puppeteer');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const IMAGE_PATH = './radar-latest.png'; // keep filename consistent with your URL

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

        // Go to radar page
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Hide cookie banner if present
        try {
            await page.evaluate(() => {
                const banner = document.querySelector('.cc-compliance');
                if (banner) banner.style.display = 'none';
            });
            console.log('Cookie banner hidden.');
        } catch {
            console.log('No cookie banner to hide.');
        }

        // Wait a short moment for map to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot
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
setInterval(fetchRadar, 10 * 60 * 1000);

// Minimal server to serve static files
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// Serve all files in this directory
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
