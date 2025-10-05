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

        await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'domcontentloaded' });

        // Inject cookie directly
        await page.evaluate(() => {
            document.cookie = "noa_radar_cookie=accepted; path=/; domain=.meteo.noa.gr";
        });

        // Reliable removal of cookie banner (frames + retry)
        const removeCookieBanner = async () => {
            for (let i = 0; i < 20; i++) { // ~10 sec
                const removed = await page.evaluate(() => {
                    // remove main page banner
                    const mainBanner = document.querySelector('.cc-window');
                    if (mainBanner) { mainBanner.remove(); return true; }

                    // remove banners inside iframes
                    const iframes = Array.from(document.querySelectorAll('iframe'));
                    let found = false;
                    iframes.forEach(f => {
                        try {
                            const doc = f.contentDocument || f.contentWindow.document;
                            const b = doc.querySelector('.cc-window');
                            if (b) { b.remove(); found = true; }
                        } catch(e) {}
                    });
                    return found;
                });
                if (removed) break;
                await new Promise(r => setTimeout(r, 500));
            }
        };
        await removeCookieBanner();

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

// Route for manual/uptime updates
app.get('/update', async (req, res) => {
    try {
        await fetchRadar();
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
