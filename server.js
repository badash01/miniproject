import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

await loadEnv();

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3001);

const llmConfig = {
  apiKey: process.env.LLM_API_KEY,
  apiUrl: process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions",
  model: process.env.LLM_MODEL || "gpt-4o-mini",
  provider: process.env.LLM_PROVIDER || (process.env.LLM_API_KEY?.startsWith("AIza") ? "gemini" : "openai"),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

createServer(async (request, response) => {
  addCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      provider: llmConfig.provider,
      model: llmConfig.model,
      configured: hasUsableApiKey(),
    });
    return;
  }

  if (request.url === "/api/summarize" && request.method === "POST") {
    await handleSummarize(request, response);
    return;
  }

  await serveStatic(request, response);
}).listen(port, host, () => {
  console.log(`Research Paper Summariser running at http://${host}:${port}`);
});

async function handleSummarize(request, response) {
  try {
    if (!hasUsableApiKey()) {
      sendJson(response, 500, {
        message: "LLM_API_KEY is missing or still a placeholder. Add a new API key and restart the server.",
      });
      return;
    }

    const body = await readBody(request);
    const { text, length = "medium" } = JSON.parse(body || "{}");
    const paperText = String(text || "").trim();

    if (paperText.length < 180) {
      sendJson(response, 400, { message: "Please provide more research paper text." });
      return;
    }

    const summary = await callLlm(paperText.slice(0, 60000), length);
    sendJson(response, 200, normaliseSummary(summary));
  } catch (error) {
    sendJson(response, 500, { message: describeLlmError(error) });
  }
}

async function callLlm(text, length) {
  if (llmConfig.provider === "gemini") return callGemini(text, length);
  return callOpenAiCompatible(text, length);
}

async function callOpenAiCompatible(text, length) {
  const prompt = buildSummaryPrompt(text, length);

  const apiResponse = await fetch(llmConfig.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llmConfig.apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.LLM_HTTP_REFERER ? { "HTTP-Referer": process.env.LLM_HTTP_REFERER } : {}),
      ...(process.env.LLM_X_TITLE ? { "X-Title": process.env.LLM_X_TITLE } : {}),
    },
    body: JSON.stringify({
      model: llmConfig.model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert research assistant. Extract the problem, method, contribution, results, limitations, and viva-ready notes. Be accurate and do not invent metrics.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const payload = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    throw new Error(providerErrorMessage(payload, "LLM provider returned an error."));
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM response did not include summary content.");

  return JSON.parse(content);
}

async function callGemini(text, length) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent`;
  const prompt = buildSummaryPrompt(text, length);

  const apiResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": llmConfig.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are an expert research assistant. Extract the problem, method, contribution, results, limitations, and viva-ready notes. Be accurate and do not invent metrics.",
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    throw new Error(providerErrorMessage(payload, "Gemini API returned an error."));
  }

  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!content) throw new Error("Gemini response did not include summary content.");

  return JSON.parse(content);
}

function buildSummaryPrompt(text, length) {
  return `Summarise this research paper for a student project.

Return only valid JSON with this exact shape:
{
  "title": "string",
  "keywords": ["string"],
  "abstract": "string",
  "contributions": ["string"],
  "methodology": "string",
  "findings": "string",
  "notes": ["string"]
}

Summary length: ${length}
Paper text:
${text}`;
}

function normaliseSummary(summary) {
  return {
    title: stringOr(summary.title, "Research Paper Summary"),
    keywords: arrayOr(summary.keywords).slice(0, 10),
    abstract: stringOr(summary.abstract, "No abstract summary returned."),
    contributions: arrayOr(summary.contributions).slice(0, 8),
    methodology: stringOr(summary.methodology, "No methodology summary returned."),
    findings: stringOr(summary.findings, "No findings summary returned."),
    notes: arrayOr(summary.notes).slice(0, 8),
  };
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requestedPath))
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 3_000_000) {
        reject(new Error("Request is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function addCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function providerErrorMessage(payload, fallback) {
  return payload.error?.metadata?.raw || payload.error?.message || payload.error?.status || fallback;
}

function hasUsableApiKey() {
  const key = llmConfig.apiKey?.trim() || "";
  return Boolean(key && !/^your_|replace_with_/i.test(key) && key !== "secret_key");
}

function describeLlmError(error) {
  const message = error.message || "Could not summarize paper.";

  if (/reported as leaked|leaked.*api key|api key.*leaked/i.test(message)) {
    return "The configured API key was reported as leaked. Revoke it, create a new key, update LLM_API_KEY in .env, and restart the server.";
  }

  if (/api key not valid|invalid api key|unauthorized|permission_denied/i.test(message)) {
    return "The configured API key was rejected. Add a valid key to LLM_API_KEY in .env and restart the server.";
  }

  return message;
}

function arrayOr(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function loadEnv() {
  try {
    const envText = await readFile(join(root, ".env"), "utf8");
    envText.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separator = trimmed.indexOf("=");
      if (separator === -1) return;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // The project can still run without .env; /api/summarize will explain missing keys.
  }
}
