# Use Node 22 slim
FROM node:22-slim

# Install system dependencies for Puppeteer and canvas
RUN apt-get update && apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget \
    libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev build-essential python3 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package.json first for faster rebuilds
COPY package.json package-lock.json* ./

# Install Node dependencies
RUN npm install

# Copy app files
COPY . .

# Expose the port
EXPOSE 10000

# Start the app
CMD ["npm", "start"]
