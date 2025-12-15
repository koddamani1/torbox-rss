const express = require('express');
const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const parser = require('fast-xml-parser');
const cheerio = require('cheerio');

// TorBox API info
const TORBOX_API_KEY = "183247a9-6cc2-4d50-aa0f-8ed8253fa0c7"; // Din TorBox API-nøgle

// RSS feed fra TamilMV
const RSS_FEED = "https://www.1tamilmv.kiwi/index.php?/forums/forum/19-web-series-tv-shows.xml/";

// Stremio addon manifest
const manifest = {
    id: "org.vithushan.tamilmv.rss",
    version: "1.0.0",
    name: "TamilMV RSS → TorBox",
    description: "Addon der scraper magnet-links fra 1TamilMV til TorBox",
    resources: ["stream"],
    types: ["movie","series"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// Hent magnet-links fra RSS
async function getMagnetLinksFromRSS() {
    try {
        const response = await axios.get(RSS_FEED);
        const data = parser.parse(response.data, {ignoreAttributes: false});
        const items = data.rss.channel.item || [];

        let results = [];

        for (let item of items) {
            const title = item.title["#text"] || item.title;
            const link = item.link;

            // Hent magnet fra topic-siden
            try {
                const page = await axios.get(link);
                const $ = cheerio.load(page.data);
                const magnet = $("a[href^='magnet:']").attr("href");
                if (magnet) results.push({ title, magnet });
            } catch(e) {
                console.log("Fejl på side:", link);
            }
        }
        return results;
    } catch (err) {
        console.error("RSS fetch error:", err);
        return [];
    }
}

// Stremio stream handler
builder.defineStreamHandler(async function(args) {
    const links = await getMagnetLinksFromRSS();
    return links.map(item => ({
        id: item.magnet,
        title: item.title,
        magnet: item.magnet
    }));
});

// Express server
const app = express();
app.get('/manifest.json', (req, res) => res.json(manifest));
app.use(builder.getInterface()); // addon interface

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Addon kører på port ${PORT}`));
