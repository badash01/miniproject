const apiUrl = "http://127.0.0.1:3001/api/summarize";

const paperText = document.querySelector("#paperText");
const detectBtn = document.querySelector("#detectBtn");
const detectBadge = document.querySelector("#detectBadge");
const sourceTitle = document.querySelector("#sourceTitle");
const sourceMeta = document.querySelector("#sourceMeta");
const selectionBtn = document.querySelector("#selectionBtn");
const summariseBtn = document.querySelector("#summariseBtn");
const lengthSelect = document.querySelector("#lengthSelect");
const statusText = document.querySelector("#status");
const result = document.querySelector("#result");

const output = {
  title: document.querySelector("#title"),
  keywords: document.querySelector("#keywords"),
  abstract: document.querySelector("#abstract"),
  contributions: document.querySelector("#contributions"),
  methodology: document.querySelector("#methodology"),
  findings: document.querySelector("#findings"),
};

let detectedText = "";

document.addEventListener("DOMContentLoaded", detectPaperOnCurrentTab);
detectBtn.addEventListener("click", detectPaperOnCurrentTab);

selectionBtn.addEventListener("click", async () => {
  setStatus("Reading selected text");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });

    paperText.value = injection.result || "";
    setStatus(paperText.value ? "Selection loaded" : "No text selected");
  } catch (error) {
    setStatus("Could not read selection");
  }
});

summariseBtn.addEventListener("click", async () => {
  let text = paperText.value.trim() || detectedText.trim();

  if (text.length < 180) {
    await detectPaperOnCurrentTab();
    text = paperText.value.trim() || detectedText.trim();
  }

  if (text.length < 180) {
    setStatus("No research paper text detected on this page");
    return;
  }

  setStatus("Summarising with LLM");
  summariseBtn.disabled = true;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, length: lengthSelect.value }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Summary failed");

    renderSummary(payload);
    setStatus("Complete");
  } catch (error) {
    setStatus(error.message || "Start backend and check API key");
  } finally {
    summariseBtn.disabled = false;
  }
});

async function detectPaperOnCurrentTab() {
  setDetection("Scanning", "Looking for a research paper", "Checking selected text, metadata, article body, and paper sections.");
  setStatus("Scanning current page");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractResearchPaperFromPage,
    });

    const detection = injection.result;
    detectedText = detection.text || "";
    paperText.value = detectedText;

    if (detection.isResearchPaper && detectedText.length >= 180) {
      setDetection("Detected", detection.title, `${detection.words} words found from ${detection.source}.`);
      setStatus("Ready to summarise detected paper");
      return;
    }

    if (detectedText.length >= 180) {
      setDetection("Possible", detection.title, `${detection.words} words found, but paper confidence is low.`);
      setStatus("You can summarise this detected text");
      return;
    }

    setDetection("Not found", "No paper text detected", detection.message || "Try an HTML abstract page, article page, or select text manually.");
    setStatus("Open a paper page or select text");
  } catch (error) {
    setDetection("Blocked", "Cannot scan this page", "Chrome blocks extensions on some internal pages and PDF viewers.");
    setStatus("Select text manually or open the paper abstract page");
  }
}

function extractResearchPaperFromPage() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const wordCount = (value) => clean(value).split(/\s+/).filter(Boolean).length;
  const selectedText = clean(window.getSelection?.().toString());
  const meta = (name) =>
    clean(
      document.querySelector(`meta[name="${name}"]`)?.content ||
        document.querySelector(`meta[property="${name}"]`)?.content
    );

  const title =
    meta("citation_title") ||
    meta("dc.Title") ||
    clean(document.querySelector("h1")?.innerText) ||
    clean(document.title) ||
    "Detected Research Paper";

  const abstract =
    meta("citation_abstract") ||
    meta("description") ||
    clean(document.querySelector(".abstract, #abstract, section[id*='abstract' i], div[class*='abstract' i]")?.innerText);

  if (selectedText.length > 300) {
    return {
      title,
      source: "selected page text",
      text: selectedText.slice(0, 90000),
      words: wordCount(selectedText),
      isResearchPaper: looksLikePaper(`${title} ${selectedText}`),
    };
  }

  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".ltx_document",
    ".article",
    ".paper",
    ".document",
    ".content",
    "#content",
    "body",
  ];

  const candidates = selectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean)
    .map((node) => {
      const text = collectReadableText(node);
      return {
        selector: node.tagName.toLowerCase() + (node.id ? `#${node.id}` : ""),
        text,
        score: scorePaperText(`${title} ${abstract} ${text}`),
        words: wordCount(text),
      };
    })
    .filter((candidate) => candidate.words >= 80)
    .sort((a, b) => b.score - a.score || b.words - a.words);

  const best = candidates[0];
  const combined = clean([title, abstract, best?.text].filter(Boolean).join("\n\n"));

  if (!best && abstract.length < 180) {
    return {
      title,
      source: "page",
      text: "",
      words: 0,
      isResearchPaper: false,
      message: "No readable article text was found.",
    };
  }

  return {
    title,
    source: best?.selector || "metadata",
    text: combined.slice(0, 90000),
    words: wordCount(combined),
    isResearchPaper: looksLikePaper(combined),
  };

  function collectReadableText(root) {
    const skipTags = new Set(["SCRIPT", "STYLE", "NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "BUTTON", "NOSCRIPT"]);
    const blocks = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (skipTags.has(node.tagName)) continue;

      const tag = node.tagName.toLowerCase();
      const text = clean(node.innerText);
      const directText = clean([...node.childNodes].map((child) => (child.nodeType === Node.TEXT_NODE ? child.textContent : "")).join(" "));

      if (/h[1-3]|p|li|blockquote|figcaption|section|div/.test(tag) && directText.length > 40) {
        blocks.push(directText);
      } else if ((tag === "abstract" || node.id?.toLowerCase().includes("abstract")) && text.length > 80) {
        blocks.push(text);
      }
    }

    if (blocks.length < 4) {
      return clean(root.innerText);
    }

    return blocks
      .filter((block, index, list) => list.indexOf(block) === index)
      .join("\n\n");
  }

  function scorePaperText(text) {
    const lower = text.toLowerCase();
    const signals = [
      "abstract",
      "introduction",
      "methodology",
      "method",
      "results",
      "experiment",
      "evaluation",
      "references",
      "doi",
      "arxiv",
      "keywords",
      "dataset",
      "accuracy",
      "conclusion",
      "proposed",
    ];

    return signals.reduce((score, signal) => score + (lower.includes(signal) ? 1 : 0), 0) + Math.min(wordCount(text) / 700, 10);
  }

  function looksLikePaper(text) {
    return scorePaperText(text) >= 7;
  }
}

function setDetection(badge, title, meta) {
  detectBadge.textContent = badge;
  sourceTitle.textContent = title;
  sourceMeta.textContent = meta;
}

function renderSummary(summary) {
  result.hidden = false;
  output.title.textContent = summary.title || "Research Paper Summary";
  output.keywords.innerHTML = (summary.keywords || [])
    .map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`)
    .join("");
  output.abstract.textContent = summary.abstract || "";
  output.contributions.innerHTML = (summary.contributions || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  output.methodology.textContent = summary.methodology || "";
  output.findings.textContent = summary.findings || "";
}

function setStatus(message) {
  statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}
