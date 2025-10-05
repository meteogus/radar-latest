const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

// Serve static files
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

        // Set initial cookie before visiting
        await page.setCookie({
            name: 'noa_radar_cookie',
            value: 'accepted',
            domain: '.meteo.noa.gr',
            path: '/'
        });

        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'domcontentloaded' });

        // Try to accept cookies dynamically if banner appears
        try {
            await page.waitForSelector('.cc-window', { timeout: 5000 });
            await page.evaluate(() => {
                const banner = document.querySelector('.cc-window');
                const btn = document.querySelector('.cc-allow, .cc-dismiss, button');
                if (btn) btn.click();
                if (banner) banner.remove();
                document.cookie = "noa_radar_cookie=accepted; path=/; domain=.meteo.noa.gr";
            });
            console.log('✅ Cookie banner handled.');
        } catch {
            console.log('No cookie banner detected.');
        }

        await new Promise(resolve => setTimeout(resolve, 1500)); // small wait for stability

        const screenshotBuffer = await page.screenshot();

        // Add timestamp (Athens local time)
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

// Fetch every 10 minutes
cron.schedule('*/10 * * * *', fetchRadar);

// Serve radar image
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// Manual trigger
app.get('/update', async (req, res) => {
    try {
        await fetchRadar();
        res.send('Radar image updated successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating radar image.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // initial run
});
