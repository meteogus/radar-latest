const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const FILE_PATH = 'radar-latest.png';
const URL = 'https://nowcast.meteo.noa.gr/el/radar/';

async function fetchRadar() {
    console.log('Fetching radar image...');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle2' });
    
    // Take screenshot of the full page
    const screenshotBuffer = await page.screenshot();

    // Load into canvas to add timestamp
    const img = await loadImage(screenshotBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Add timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    ctx.font = '30px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(timestamp, 20, img.height - 20);

    // Save final image
    const out = fs.createWriteStream(FILE_PATH);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('Radar saved:', FILE_PATH));

    await browser.close();
}

// Fetch every 5 minutes
cron.schedule('*/5 * * * *', fetchRadar);

// Initial fetch
fetchRadar();

// Serve the image
app.get(`/${FILE_PATH}`, (req, res) => {
    res.sendFile(`${__dirname}/${FILE_PATH}`);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
