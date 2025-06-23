const express = require("express");
const cors = require("cors");
const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");
const { JSDOM } = require("jsdom");

const app = express();
app.use(cors());
app.use(express.json());

async function getAllPages(startUrl) {
  const visited = new Set();
  const toVisit = [startUrl];
  const pages = [];

  while (toVisit.length > 0) {
    const url = toVisit.pop();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const res = await fetch(url);
      const html = await res.text();
      pages.push(url);
      const dom = new JSDOM(html);
      const anchors = [...dom.window.document.querySelectorAll("a")];
      for (const a of anchors) {
        const href = a.href;
        if (href.startsWith(startUrl) && !visited.has(href)) {
          toVisit.push(href);
        }
      }
    } catch (e) {
      console.error("Failed to crawl:", url, e.message);
    }
  }
  return pages;
}

app.post("/scan", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
    const options = { port: chrome.port, output: "json" };

    const pages = await getAllPages(url);
    const issues = [];
    let totalScore = 0;
    let count = 0;

    for (const page of pages) {
      try {
        const result = await lighthouse(page, options);
        const audits = result.lhr.audits;
        const score = result.lhr.categories.performance.score * 100;
        totalScore += score;
        count++;

        if (audits["unused-css-rules"]?.score !== 1) {
          issues.push({ page, message: "Unused CSS detected" });
        }

        if (audits["dom-size"]?.score !== 1) {
          issues.push({ page, message: "Excessive DOM siz
