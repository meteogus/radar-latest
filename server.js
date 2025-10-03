const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

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

        // Hide cookies bar robustly
        await page.evaluate(() => {
            const interval = setInterval(() => {
                const cookieBanner = document.querySelector('#cookies-popup, .cookies-bar, .cookie-consent');
                if (cookieBanner) cookieBanner.style.display = 'none';
            }, 200); // check every 200ms
            setTimeout(() => clearInterval(interval), 5000); // stop after 5s
        });

        const screenshotBuffer = await page.screenshot();

        // Add timestamp (keep your current format)
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';
        const timestamp = new Date().toLocaleString(); // unchanged
        ctx.fillText(timestamp, 10, 30); // upper-left corner

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

// Express route
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // fetch immediately on start
});
