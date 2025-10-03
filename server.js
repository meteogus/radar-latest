const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { createCanvas, loadImage } = require('canvas');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = path.join(__dirname, 'radar-latest.png');

async function fetchRadar() {
    console.log('Fetching radar image...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 750, height: 533 });
    await page.goto('https://nowcast.meteo.noa.gr/el/radar/', { waitUntil: 'networkidle2' });

    const canvasData = await page.evaluate(() => {
        const canvas = document.querySelector('canvas.leaflet-layer.velocity-overlay');
        return canvas.toDataURL();
    });

    await browser.close();

    // Create canvas and add timestamp
    const base64Data = canvasData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const img = await loadImage(buffer);

    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Draw black timestamp bottom-left
    const timestamp = new Date().toLocaleString();
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(timestamp, 10, img.height - 10);

    const out = fs.createWriteStream(IMAGE_PATH);
    const stream = c.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('Radar saved with timestamp:', IMAGE_PATH));
}

// Fetch every 5 minutes
cron.schedule('*/5 * * * *', fetchRadar);

// First fetch immediately
fetchRadar();

// Serve image
app.get('/radar-latest.png', (req, res) => {
    res.sendFile(IMAGE_PATH);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
