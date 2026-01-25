const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';
const CROP_BOTTOM_PX = 100;

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
        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', {
            waitUntil: 'networkidle2'
        });

        // Hide cookie banner if it appears
        try {
            await page.evaluate(() => {
                const cookie = document.querySelector('#cookiescript_accept');
                if (cookie) cookie.click();
            });
        } catch (e) {
            console.log('No cookie popup found');
        }

        const screenshotBuffer = await page.screenshot();

        // Load screenshot
        const img = await loadImage(screenshotBuffer);

        // Crop bottom 100px
        const croppedWidth = img.width;
        const croppedHeight = img.height - CROP_BOTTOM_PX;

        if (croppedHeight <= 0) {
            throw new Error('Crop size larger than image height');
        }

        const canvas = createCanvas(croppedWidth, croppedHeight);
        const ctx = canvas.getContext('2d');

        // Draw image without bottom part
        ctx.drawImage(
            img,
            0, 0,
            croppedWidth, croppedHeight,
            0, 0,
            croppedWidth, croppedHeight
        );

        // Add timestamp (Athens local time)
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';

        const now = new Date();
        const athensTime = now.toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
        const [date, time] = athensTime.split(', ');
        const formatted = `${date} ${time}`;
        ctx.fillText(formatted, 10, 30);

        // Save image
        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        out.on('finish', () => {
            console.log('Radar image saved (cropped).');
        });

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Serve all static files
app.use(express.static(__dirname));

// Image route
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// Manual update route
app.get('/update', async (req, res) => {
    console.log('Manual update requested...');
    await fetchRadar();
    res.send('Radar updated successfully!');
});

// Cron job every 10 minutes
cron.schedule('*/10 * * * *', fetchRadar);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // initial fetch
});
