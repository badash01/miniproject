const paperText = document.querySelector("#paperText");
const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const summariseBtn = document.querySelector("#summariseBtn");
const statusPill = document.querySelector("#statusPill");
const lengthButtons = [...document.querySelectorAll("[data-length]")];

const output = {
  title: document.querySelector("#titleGuess"),
  keywords: document.querySelector("#keywords"),
  abstract: document.querySelector("#abstractSummary"),
  contributions: document.querySelector("#contributions"),
  methodology: document.querySelector("#methodology"),
  findings: document.querySelector("#findings"),
  studyNotes: document.querySelector("#studyNotes"),
};

let selectedLength = "short";

const stopWords = new Set(
  "a an and are as at be been by can could for from has have in into is it its may more most of on or our paper research study such than that the their these this to was we were which with using used uses use also based".split(
    " "
  )
);

lengthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lengthButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedLength = button.dataset.length;
  });
});

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await loadFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  if (file) await loadFile(file);
});

summariseBtn.addEventListener("click", async () => {
  const text = cleanText(paperText.value);

  if (text.length < 180) {
    setStatus("Need more text");
    output.abstract.textContent = "Paste or upload at least a few paragraphs from the research paper.";
    return;
  }

  setStatus("LLM summarising");
  summariseBtn.disabled = true;

  try {
    const summary = await summariseWithApi(text, selectedLength);
    renderSummary(summary);
    setStatus("LLM complete");
  } catch (error) {
    const summary = summarisePaper(text, selectedLength);
    renderSummary(summary);
    setStatus("Local fallback");
  } finally {
    summariseBtn.disabled = false;
  }
});

async function loadFile(file) {
  setStatus("Reading file");

  try {
    if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      paperText.value = await readPdf(file);
    } else {
      paperText.value = await file.text();
    }

    setStatus(`${wordCount(paperText.value)} words`);
  } catch (error) {
    setStatus("File error");
    output.abstract.textContent =
      "Could not read this file. If it is a scanned PDF, convert it with OCR first or paste the text manually.";
  }
}

async function readPdf(file) {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }

  return pages.join("\n\n");
}

async function summariseWithApi(text, length) {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, length }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "LLM API request failed");
  }

  return response.json();
}

function summarisePaper(text, length) {
  const sections = splitSections(text);
  const sentences = splitSentences(text);
  const ranked = rankSentences(sentences, topKeywords(text, 16));
  const count = length === "detailed" ? 7 : length === "medium" ? 5 : 3;

  const title = guessTitle(text);
  const keywords = topKeywords(text, 8);
  const topSentences = ranked.slice(0, count).map((item) => item.sentence);

  return {
    title,
    keywords,
    abstract: topSentences.join(" "),
    contributions: pickBullets(ranked, ["propose", "present", "introduce", "contribution", "novel", "improve"], count),
    methodology: findSectionSummary(sections, ["method", "methodology", "approach", "model", "architecture"], ranked),
    findings: findSectionSummary(sections, ["result", "finding", "evaluation", "experiment", "performance"], ranked),
    notes: buildStudyNotes(text, sections, keywords),
  };
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").replace(/-\s+/g, "").trim();
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 45 && sentence.length < 360);
}

function topKeywords(text, limit) {
  const counts = new Map();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function rankSentences(sentences, keywords) {
  return sentences
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const keywordScore = keywords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
      const signalScore = /propose|result|show|demonstrate|method|approach|model|accuracy|dataset|experiment/i.test(
        sentence
      )
        ? 2
        : 0;
      const positionScore = index < 8 ? 1.5 : 0;

      return { sentence, score: keywordScore + signalScore + positionScore };
    })
    .sort((a, b) => b.score - a.score);
}

function splitSections(text) {
  const sectionNames = ["abstract", "introduction", "methodology", "method", "approach", "results", "discussion", "conclusion"];
  const pattern = new RegExp(`\\b(${sectionNames.join("|")})\\b`, "gi");
  const matches = [...text.matchAll(pattern)];
  const sections = {};

  matches.forEach((match, index) => {
    const name = match[1].toLowerCase();
    const start = match.index;
    const end = matches[index + 1]?.index || text.length;
    sections[name] = cleanText(text.slice(start, end));
  });

  return sections;
}

function findSectionSummary(sections, names, ranked) {
  const section = names.map((name) => sections[name]).find(Boolean);
  const source = section ? splitSentences(section) : ranked.map((item) => item.sentence);
  return source.slice(0, 2).join(" ") || "This section was not clearly identified in the provided text.";
}

function pickBullets(ranked, signals, limit) {
  const picked = ranked
    .filter(({ sentence }) => signals.some((signal) => sentence.toLowerCase().includes(signal)))
    .slice(0, Math.max(3, Math.min(limit, 5)))
    .map(({ sentence }) => sentence);

  return picked.length ? picked : ranked.slice(0, 3).map((item) => item.sentence);
}

function guessTitle(text) {
  const lines = text
    .split(/\n|(?<=\.)\s/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12 && line.length < 140);

  const candidate = lines.find((line) => !/abstract|introduction|copyright|doi|keywords/i.test(line));
  return candidate || "Research Paper Summary";
}

function buildStudyNotes(text, sections, keywords) {
  const notes = [
    `Main topic focus: ${keywords.slice(0, 4).join(", ") || "not enough keyword data"}.`,
    `Paper size analysed: about ${wordCount(text)} words.`,
  ];

  if (sections.conclusion) {
    notes.push("Conclusion section detected, so the findings summary uses paper structure when possible.");
  }

  notes.push("For project viva: explain the problem statement, method, dataset or input source, and final result metrics.");
  return notes;
}

function renderSummary(summary) {
  output.title.textContent = summary.title;
  output.keywords.innerHTML = summary.keywords.map((word) => `<span class="keyword">${escapeHtml(word)}</span>`).join("");
  output.abstract.textContent = summary.abstract;
  renderList(output.contributions, summary.contributions);
  output.methodology.textContent = summary.methodology;
  output.findings.textContent = summary.findings;
  renderList(output.studyNotes, summary.notes);
}

function renderList(element, items) {
  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function setStatus(message) {
  statusPill.textContent = message;
}

function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}
