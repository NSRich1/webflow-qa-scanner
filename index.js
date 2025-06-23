const express = require("express");
const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");
const { JSDOM } = require("jsdom");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/scan", async (req, res) => {
  const targetUrl = req.body.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing URL" });

  try {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
    const options = { logLevel: "info", output: "json", port: chrome.port };
    const runnerResult = await lighthouse(targetUrl, options);

    const report = JSON.parse(runnerResult.report);
    const score = Math.round(report.categories.performance.score * 100);

    await chrome.kill();

    res.json({
      score,
      audits: {
        unusedCss: report.audits["unused-css-rules"],
        domSize: report.audits["dom-size"],
        cachePolicy: report.audits["uses-long-cache-ttl"],
        consoleErrors: report.audits["errors-in-console"]
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Audit failed." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ QA Scanner running on port ${port}`));
