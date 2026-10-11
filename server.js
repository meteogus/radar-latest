
const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

const IMAGE_PATH = path.join(__dirname, 'radar-latest.png');
const CROP_BOTTOM_PX = 70;

let isFetching = false;

async function fetchRadar() {
    if (isFetching) {
        console.log('Radar fetch already running. Skipping this update.');
        return false;
    }

    isFetching = true;

    let browser = null;
    let page = null;

    try {
        console.log('Fetching radar image...');

        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--no-first-run',
                '--no-default-browser-check'
            ]
        });

        page = await browser.newPage();

        await page.setViewport({
            width: 800,
            height: 600
        });

        await page.goto(
            'https://nowcast.meteo.noa.gr/el/radar/',
            {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            }
        );

        // Allow time for the radar map and tiles to render.
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Hide cookie banner if it appears.
        try {
            await page.evaluate(() => {
                const cookie = document.querySelector(
                    '#cookiescript_accept'
                );

                if (cookie) {
                    cookie.click();
                }
            });
        } catch (e) {
            console.log('No cookie popup found');
        }

        // Capture the page.
        const screenshotBuffer = await page.screenshot({
            type: 'png'
        });

        await page.close();
        page = null;

        let img = await loadImage(screenshotBuffer);

        const croppedWidth = img.width;
        const croppedHeight = img.height - CROP_BOTTOM_PX;

        if (croppedHeight <= 0) {
            throw new Error('Crop size larger than image height');
        }

        let canvas = createCanvas(
            croppedWidth,
            croppedHeight
        );

        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            img,
            0,
            0,
            croppedWidth,
            croppedHeight,
            0,
            0,
            croppedWidth,
            croppedHeight
        );

        // Add Athens timestamp.
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';

        const now = new Date();

        const athensTime = now.toLocaleString('el-GR', {
            timeZone: 'Europe/Athens'
        });

        const [date, time] = athensTime.split(', ');
        const formatted = `${date} ${time}`;

        ctx.fillText(formatted, 10, 30);

        // Save the image and wait for writing to finish.
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(IMAGE_PATH);
            const stream = canvas.createPNGStream();

            stream.on('error', reject);
            out.on('error', reject);

            out.on('finish', () => {
                console.log('Radar image saved successfully.');
                resolve();
            });

            stream.pipe(out);
        });

        img = null;
        canvas = null;

        return true;

    } catch (err) {
        console.error('Error fetching radar:', err);
        return false;

    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {
                console.log('Error closing page:', e.message);
            }
        }

        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.log('Error closing browser:', e.message);
            }
        }

        isFetching = false;

        console.log('Radar fetch finished. Resources released.');
    }
}

// Serve static files without caching.
app.use(express.static(__dirname, {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Radar image endpoint.
app.get('/radar-latest.png', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(IMAGE_PATH);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// Manual update endpoint.
app.get('/update', async (req, res) => {
    if (isFetching) {
        return res.status(429).send(
            'Radar update already in progress.'
        );
    }

    console.log('Manual update requested...');

    const success = await fetchRadar();

    if (success) {
        res.send('Radar updated successfully!');
    } else {
        res.status(500).send('Radar update failed.');
    }
});

// Automatic update every 10 minutes.
cron.schedule('*/10 * * * *', () => {
    console.log('10-minute radar update triggered.');
    fetchRadar();
});

// Start server.
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar();
});
