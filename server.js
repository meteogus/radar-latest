const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

// --- Fetch radar image and add timestamp ---
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

        // Try to close the cookie popup if it appears
        try {
            await page.evaluate(() => {
                const btn = document.querySelector('.cc-dismiss, .cookie-btn, button[aria-label="close"], button[onclick*="cookie"]');
                if (btn) btn.click();
            });
        } catch (e) {
            console.log('No cookie popup found.');
        }

        const screenshotBuffer = await page.screenshot();
        await browser.close();

        // Add timestamp (Athens local time, day/month/year)
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '24px sans-serif';
        ctx.fillStyle = 'yellow';
        const now = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
        ctx.fillText(now, 15, 30);

        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// --- Serve all static files ---
app.use(express.static(__dirname));

// --- Route for radar image ---
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// --- NEW: Instant-response route for cron-job.org ---
app.get('/update', (req, res) => {
    res.send('Radar update started.'); // respond instantly (under 1 second)
    fetchRadar(); // run in background
});

// --- Fetch every 10 minutes (server-side) ---
cron.schedule('*/10 * * * *', fetchRadar);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // fetch immediately on start
});
