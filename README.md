# Research Paper Summariser

A web development AI/ML mini project that summarises research papers from pasted text, `.txt` files, PDFs, or selected browser text through a Chrome extension.

## Features

- Upload PDF or TXT files
- Paste research paper text manually
- Choose short, medium, or detailed summary length
- Extract title guess, keywords, abstract summary, key contributions, methodology, findings, and study notes
- Uses an LLM API through a Node backend
- Includes a Chrome extension popup that automatically detects research-paper text on the current site
- Falls back to a lightweight browser summariser when the LLM API is not configured

## Tech Stack

- HTML
- CSS
- JavaScript
- Node.js
- PDF.js for PDF text extraction
- OpenAI-compatible LLM API

## How It Works

The production path uses an LLM API:

1. The frontend or Chrome extension sends paper text to the local Node backend.
2. The backend calls an OpenAI-compatible chat completions API.
3. The LLM returns structured JSON containing title, keywords, summary, contributions, methodology, findings, and notes.
4. The UI renders the structured output.

If the API key is missing, the web app can still use a local extractive fallback:

1. Cleans the research paper text.
2. Splits the text into sentences.
3. Extracts frequent keywords after removing common stop words.
4. Scores sentences using keyword frequency, research-paper signals, and sentence position.
5. Selects the highest scoring sentences for the final summary.

## Run

Create a `.env` file:

```bash
cp .env.example .env
```

Add your API key:

```text
LLM_PROVIDER=openai
LLM_API_KEY=your_api_key_here
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_MODEL=google/gemma-4-26b-a4b-it:free
LLM_HTTP_REFERER=http://127.0.0.1:3001
LLM_X_TITLE=Research Paper Summariser
PORT=3001
```

If the provider says the API key was leaked, revoke that key in the provider dashboard, create a new one, replace only `LLM_API_KEY` in `.env`, and restart `npm start`. Do not reuse the reported key.

As of April 24, 2026, OpenRouter lists the free model ID as `google/gemma-4-26b-a4b-it:free`.

Start the backend and web app:

```bash
npm start
```

Then visit:

```text
http://127.0.0.1:3001
```

## Free Deployment

This project is prepared for free deployment on Render with the included [`render.yaml`](/Users/ashoksinghdhami/Documents/New%20project/render.yaml).

Why Render:

- Render currently offers free web services for hobby/testing use.
- This app includes a Node backend, so it needs a host for both frontend files and the secret-backed API.
- Render supports environment variables and a public URL on the free tier. See [Render free docs](https://render.com/docs/free) and [web services docs](https://render.com/docs/web-services).

Steps:

1. Push this project to GitHub.
2. Sign in to Render.
3. Create a new Blueprint or Web Service from the repo.
4. Set `LLM_API_KEY` in Render as a secret environment variable.
5. Deploy.

Important:

- Render requires the app to bind to `0.0.0.0`, which this project now supports.
- The free tier has limitations and is best for demos, student projects, and testing.

## Chrome Extension

1. Start the backend with `npm start`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on Developer Mode.
4. Click **Load unpacked**.
5. Select the `extension` folder inside this project.
6. Open any research paper webpage, click the extension, and it will scan the page automatically.
7. Click **Summarise** without pasting text.

The extension works best on HTML paper pages such as abstract pages, journal article pages, arXiv abstract pages, and conference paper pages. Some browser PDF viewers block extension text extraction; if that happens, open the paper's abstract/article HTML page or select text manually.

## Project Use

This project is suitable for an AI/ML or web development mini project demonstration. You can explain it as a full-stack LLM application with prompt engineering, structured JSON output, and a browser extension interface.
