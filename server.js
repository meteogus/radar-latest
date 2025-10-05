const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

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

        // Add timestamp (Athens local time, dd/mm/yyyy hh:mm)
        const img = await loadImage(screenshotBuffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';

        const now = new Date();
        const athensTime = now.toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
        const [date, time] = athensTime.split(', ');
        const formatted = `${date} ${time}`;
        ctx.fillText(formatted, 10, 30);

        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log('Radar image saved.'));

        await browser.close();
    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Serve all static files in project directory
app.use(express.static(__dirname));

// Express route to view image
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

// ✅ Manual update route for external cron
app.get('/update', async (req, res) => {
    console.log('Manual update requested...');
    await fetchRadar();
    res.send('Radar updated successfully!');
});

// Regular Render cron (optional, backup)
cron.schedule('*/10 * * * *', fetchRadar);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // initial fetch
});
