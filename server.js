const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

// Serve all files in project folder (so /radar-latest.png works)
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

        // Optional: block cookies bar
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.url().includes('cookie') || req.url().includes('consent')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'networkidle2' });

        const screenshotBuffer = await page.screenshot();

        // Add timestamp in Athens local time, day/month/year
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';

        const athensTime = new Date().toLocaleString("en-GB", { timeZone: "Europe/Athens" });
        ctx.fillText(athensTime, 10, 30); // upper-left corner

        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Fetch every 10 minutes
cron.schedule('*/10 * * * *', fetchRadar);


// Health check route for cron-job.org
app.get('/', (req, res) => {
    res.send('Radar service alive');
});


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


