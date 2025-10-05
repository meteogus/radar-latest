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

        // Preload cookie
        await page.setCookie({
            name: 'noa_radar_cookie',
            value: 'accepted',
            domain: '.meteo.noa.gr',
            path: '/'
        });

        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Try to find and remove cookie banner (also in iframe)
        try {
            // Handle top-level banner
            await page.evaluate(() => {
                document.cookie = "noa_radar_cookie=accepted; path=/; domain=.meteo.noa.gr";
                const banner = document.querySelector('.cc-window');
                if (banner) banner.remove();
            });

            // Handle possible iframe banner
            const frames = page.frames();
            for (const frame of frames) {
                try {
                    await frame.evaluate(() => {
                        document.cookie = "noa_radar_cookie=accepted; path=/; domain=.meteo.noa.gr";
                        const banner = document.querySelector('.cc-window');
                        if (banner) banner.remove();
                        const btn = document.querySelector('.cc-allow, .cc-dismiss, button');
                        if (btn) btn.click();
                    });
                } catch { /* ignore */ }
            }

            console.log('✅ Cookie banner handled (iframe-safe).');
        } catch {
            console.log('No cookie banner found.');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

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
    fetchRadar();
});
