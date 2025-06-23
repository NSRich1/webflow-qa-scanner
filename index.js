import express from "express";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import { JSDOM } from "jsdom";
import cors from "cors";
import { URL } from "url";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/scan", async (req, res) => {
  const inputUrl = req.body.url;
  if (!inputUrl) return res.status(400).json({ error: "Missing URL" });

  const visited = new Set();
  const toVisit = [inputUrl];
  const results = [];

  try {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();

    while (toVisit.length > 0) {
      const currentUrl = toVisit.pop();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        await page.goto(currentUrl, { waitUntil: "networkidle2", timeout: 30000 });

        const consoleErrors = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        const domContent = await page.content();
        const dom = new JSDOM(domContent);
        const links = Array.from(dom.window.document.querySelectorAll("a"))
          .map((a) => a.href)
          .filter((href) => href.startsWith(inputUrl) && !visited.has(href));
        toVisit.push(...links);

        const lhUrl = new URL(currentUrl);
        const runnerResult = await lighthouse(currentUrl, {
          port: new URL(browser.wsEndpoint()).port,
          output: "json",
          logLevel: "error",
        });

        const score = runnerResult.lhr.categories.performance.score * 100;
        const domSize = runnerResult.lhr.audits["dom-size"].numericValue;
        const unusedCSS = runnerResult.lhr.audits["unused-css-rules"].displayValue;
        const cacheIssues = runnerResult.lhr.audits["uses-long-cache-ttl"].displayValue;

        results.push({
          url: currentUrl,
          score,
          domSize,
          consoleErrors,
          unusedCSS,
          cacheIssues,
        });
      } catch (err) {
        results.push({ url: currentUrl, error: err.message });
      }
    }

    await browser.close();

    res.json({
      totalPages: visited.size,
      results,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Scan failed" });
  }
});

app.listen(3000, () => console.log("✅ QA Scanner is running on port 3000"));
