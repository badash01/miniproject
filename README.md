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
LLM_API_KEY=your_api_key_here
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
PORT=3001
```

Start the backend and web app:

```bash
npm start
```

Then visit:

```text
http://127.0.0.1:3001
```

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
