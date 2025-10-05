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

        // Set cookies if necessary
        await page.setCookie({
            name: 'noa_radar_cookie',
            value: 'accepted',
            domain: 'nowcast.meteo.noa.gr'
        });

        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 // increased from default 30s
        });

        // Accept cookies by injecting JS before page fully loads
        await page.evaluate(() => {
            document.cookie = "noa_radar_cookie=accepted; path=/; domain=.meteo.noa.gr";
        });

        // Remove cookie banner reliably
        const removeCookieBanner = async () => {
            for (let i = 0; i < 20; i++) { // try for ~10 seconds (20*500ms)
                const removed = await page.evaluate(() => {
                    const banner = document.querySelector('.cc-window');
                    if (banner) { banner.remove(); return true; }
                    return false;
                });
                if (removed) break;
                await new Promise(resolve => setTimeout(resolve, 500)); // wait 0.5s
            }
        };
        await removeCookieBanner();

        // Wait 3s after removing banner to ensure it doesn’t reappear
        await new Promise(resolve => setTimeout(resolve, 3000));

        const screenshotBuffer = await page.screenshot();

        // Add timestamp (Athens local time, day/month/year, AM/PM)
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';
        const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens', hour12: true }); 
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

// Fetch every 10 minutes
cron.schedule('*/10 * * * *', fetchRadar);

// Express route to serve radar image
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// ✅ Route for manual/cron updates
app.get('/update', async (req, res) => {
    try {
        await fetchRadar(); // update the radar image
        res.send('Radar image updated successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating radar image.');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // fetch immediately on start
});
