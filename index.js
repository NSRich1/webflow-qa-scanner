import express from "express";
import cors from "cors";
import lighthouse from "lighthouse";
import chromeLauncher from "chrome-launcher";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
  const options = { logLevel: "info", output: "json", port: chrome.port };
  const runnerResult = await lighthouse(url, options);

  await chrome.kill();

  return {
    url: runnerResult.lhr.finalUrl,
    performance: runnerResult.lhr.categories.performance.score,
    accessibility: runnerResult.lhr.categories.accessibility.score,
    bestPractices: runnerResult.lhr.categories["best-practices"].score,
    seo: runnerResult.lhr.categories.seo.score,
  };
}

app.post("/scan", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing URL in request body" });
  }

  try {
    const result = await runLighthouse(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Scan failed", details: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ QA Scanner backend is running. Use POST /scan with { \"url\": \"https://example.com\" }");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

