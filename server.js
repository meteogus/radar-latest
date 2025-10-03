const express = require('express');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const IMAGE_PATH = 'radar-latest.png';

// Function to fetch radar image
async function fetchRadar() {
    try {
        console.log('Fetching radar image...');

        // Load radar image directly
        const img = await loadImage('https://www.meteo.gr/radar/latest.png');

        // Create canvas
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');

        // Draw radar image
        ctx.drawImage(img, 0, 0);

        // Add yellow timestamp (Athens local time)
        const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens' });
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(timestamp, 10, 10);

        // Save image
        const out = fs.createWriteStream(IMAGE_PATH);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => console.log(`Radar image saved: ${timestamp}`));

    } catch (err) {
        console.error('Error fetching radar:', err);
    }
}

// Fetch every 5 minutes
cron.schedule('*/5 * * * *', fetchRadar);

// Serve the image
app.get(`/${IMAGE_PATH}`, (req, res) => {
    if (fs.existsSync(IMAGE_PATH)) {
        res.sendFile(`${__dirname}/${IMAGE_PATH}`);
    } else {
        res.status(404).send('Image not found yet.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    fetchRadar(); // initial fetch
});
