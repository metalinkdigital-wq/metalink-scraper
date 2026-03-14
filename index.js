const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const SECRET = process.env.SCRAPER_SECRET || "metalink-scraper-2024";
const PORT = process.env.PORT || 3001;

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "metalink-scraper" });
});

app.post("/scrape", auth, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for security checkpoints to resolve
    await new Promise((r) => setTimeout(r, 5000));

    // If still on checkpoint, wait more
    let title = await page.title();
    if (title.toLowerCase().includes("checkpoint") || title.toLowerCase().includes("moment")) {
      await new Promise((r) => setTimeout(r, 8000));
    }

    // Scroll to trigger lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let total = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 300);
          total += 300;
          if (total >= document.body.scrollHeight || total > 5000) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    await new Promise((r) => setTimeout(r, 3000));

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
