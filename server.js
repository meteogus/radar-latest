const express = require("express");
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const app = express();
const PORT = process.env.PORT || 10000; // Render sets $PORT
const radarFile = path.join(__dirname, "radar-latest.png");

async function fetchRadar() {
  console.log("Fetching radar image...");

  // Launch Puppeteer with full Chromium
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new"
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://nowcast.meteo.noa.gr/el/radar/", {
      waitUntil: "networkidle2",
      timeout: 0
    });

    await page.waitForSelector("canvas.leaflet-layer");

    const tempFile = path.join(__dirname, "temp.png");
    const canvas = await page.$("canvas.leaflet-layer");
    await canvas.screenshot({ path: tempFile });

    await browser.close();

    const img = await loadImage(tempFile);
    const width = img.width;
    const height = img.height;

    const c = createCanvas(width, height);
    const ctx = c.getContext("2d");

    ctx.drawImage(img, 0, 0);

    // Black timestamp bottom-left
    const timestamp = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" });
    ctx.font = "24px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(timestamp, 10, height - 20);

    const out = fs.createWriteStream(radarFile);
    const stream = c.createPNGStream();
    stream.pipe(out);
    out.on("finish", () => console.log("Radar with timestamp saved:", radarFile));

    fs.unlinkSync(tempFile);

  } catch (err) {
    console.error("Error fetching radar:", err);
    await browser.close();
  }
}

// Run once at start
fetchRadar();

// Schedule every 5 minutes
cron.schedule("*/5 * * * *", fetchRadar);

// Serve radar image
app.get("/radar-latest.png", (req, res) => {
  if (fs.existsSync(radarFile)) {
    res.sendFile(radarFile);
  } else {
    res.status(404).send("Radar not available yet");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
