const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
app.use(express.json());

const SECRET = process.env.SCRAPER_SECRET || "metalink-scraper-2024";
const PORT = process.env.PORT || 3001;

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "metalink-scraper" });
});

// Scrape endpoint
app.post("/scrape", auth, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 25000,
    });

    // Wait for dynamic content
    await new Promise((r) => setTimeout(r, 2000));

    const html = await page.content();
    const finalUrl = page.url();

    await browser.close();

    res.json({ success: true, html, url: finalUrl });
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    res.status(500).json({
      error: "Failed to scrape",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Metalink Scraper running on port ${PORT}`);
});
