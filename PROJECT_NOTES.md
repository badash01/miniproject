# Research Paper Summariser - Detailed Project Notes

## 1. Project Idea in Simple Words

This project is a tool that helps a student understand a research paper quickly.

A research paper is usually long and difficult. It may contain sections like abstract, introduction, methodology, results, conclusion, and references. Reading the full paper takes time.

Our project takes the paper text, sends it to an LLM, and gets back a short, organized summary.

Think of it like this:

```text
Long research paper -> AI brain -> Easy summary
```

The project has two ways to use it:

1. Web app: Upload or paste a research paper and click Summarise.
2. Chrome extension: Open a research paper website, click the extension, and summarise without pasting text manually.

## 2. Why This Project Is Useful

Students, researchers, and teachers often need to read many research papers. This tool saves time by giving:

- Title guess
- Important keywords
- Abstract summary
- Key contributions
- Methodology
- Findings
- Study notes for viva or discussion

It does not replace reading the full paper, but it helps users understand the main idea quickly.

## 3. Main Technologies Used

### HTML

HTML creates the structure of the web page.

Example:

- Text area
- Buttons
- Upload section
- Summary output sections

### CSS

CSS makes the page look good.

It controls:

- Colors
- Layout
- Cards
- Buttons
- Mobile responsiveness

### JavaScript

JavaScript makes the project interactive.

It handles:

- Button clicks
- File upload
- PDF text reading
- Sending text to backend
- Showing summary on screen

### Node.js

Node.js runs the backend server.

The backend is important because the LLM API key should not be placed directly inside frontend code. If we put the API key inside browser JavaScript, anyone could inspect the page and steal it.

### Gemini LLM API

Gemini is the AI model used for summarisation.

The backend sends the research paper text to Gemini and asks it to return a structured summary in JSON format.

### Chrome Extension

The Chrome extension lets the user summarise research paper pages directly from the browser.

It scans the current website and tries to detect research paper content automatically.

## 4. Project Folder Structure

```text
New project/
  index.html          Web app page
  styles.css          Web app design
  app.js              Web app logic
  server.js           Node backend and LLM API logic
  package.json        Project scripts and metadata
  .env                Secret API key and config
  .env.example        Example environment file
  .gitignore          Prevents secrets from being committed
  README.md           Short setup guide
  PROJECT_NOTES.md    Detailed explanation notes
  extension/
    manifest.json     Chrome extension config
    popup.html        Extension popup UI
    popup.css         Extension popup design
    popup.js          Extension detection and summary logic
```

## 5. How the Web App Works

### Step 1: User Opens the Web App

The user opens:

```text
http://127.0.0.1:3001
```

The backend serves the frontend files.

### Step 2: User Provides Paper Text

The user can:

- Paste paper text
- Upload a TXT file
- Upload a PDF file

If a PDF is uploaded, the app uses PDF.js to extract text from the PDF.

### Step 3: User Clicks Summarise

When the user clicks the Summarise button, `app.js` sends the paper text to:

```text
/api/summarize
```

### Step 4: Backend Receives the Text

The backend checks:

- Is the text long enough?
- Is the API key available?
- Which LLM provider should be used?

In our project, the provider is Gemini.

### Step 5: Backend Sends Prompt to Gemini

The backend asks Gemini to summarise the paper and return JSON like this:

```json
{
  "title": "string",
  "keywords": ["string"],
  "abstract": "string",
  "contributions": ["string"],
  "methodology": "string",
  "findings": "string",
  "notes": ["string"]
}
```

### Step 6: Frontend Shows the Summary

The frontend receives the JSON response and displays it in separate sections.

## 6. How the Chrome Extension Works

The Chrome extension helps summarise research papers directly from a website.

### Step 1: User Opens a Research Paper Page

Example sites:

- arXiv
- IEEE
- ACM
- Springer
- ScienceDirect
- ResearchGate
- Journal article pages

### Step 2: User Clicks the Extension

When the popup opens, the extension automatically scans the current web page.

### Step 3: Extension Detects Paper Content

The extension looks for:

- Selected text
- Page title
- Abstract metadata
- `article` tag
- `main` tag
- Abstract section
- Research paper words like:
  - abstract
  - introduction
  - methodology
  - results
  - experiment
  - references
  - DOI
  - arXiv

### Step 4: Extension Fills the Text Area

If it detects enough paper text, it places that text inside the popup automatically.

### Step 5: User Clicks Summarise

The extension sends the detected text to the backend:

```text
http://127.0.0.1:3001/api/summarize
```

### Step 6: Backend Calls Gemini

The backend sends the text to Gemini and receives the summary.

### Step 7: Extension Shows the Summary

The popup displays:

- Title
- Keywords
- Summary
- Contributions
- Methodology
- Findings

## 7. Why We Use a Backend

This is very important.

The LLM API key is secret. If we put the key directly inside the frontend or Chrome extension, anyone could open developer tools and copy it.

So we use a backend.

Simple explanation:

```text
Frontend/Extension -> Backend -> Gemini API
```

The frontend never directly talks to Gemini. It talks to our backend.

This keeps the key safer.

## 8. What Is an LLM?

LLM means Large Language Model.

It is an AI model trained on a huge amount of text. It can understand and generate human-like language.

Examples:

- Gemini
- GPT
- Claude
- Llama

In this project, the LLM reads research paper text and creates a structured summary.

## 9. What Is Prompt Engineering?

Prompt engineering means writing a good instruction for the AI.

If we simply say:

```text
Summarise this.
```

The result may be random or unstructured.

Instead, our project gives clear instructions:

```text
Summarise this research paper for a student project.
Return only valid JSON with title, keywords, abstract, contributions, methodology, findings, and notes.
Do not invent metrics.
```

This makes the output easier to display in the app.

## 10. What Is JSON and Why We Use It?

JSON is a simple data format.

Example:

```json
{
  "name": "Research Paper Summariser",
  "type": "AI project"
}
```

We use JSON because the frontend can easily read it and place each part in the correct section.

For example:

- `summary.title` goes to title section
- `summary.keywords` goes to keyword badges
- `summary.methodology` goes to methodology section

## 11. What Happens If API Fails?

In the web app, there is a local fallback summariser.

If the LLM API does not work, the app still tries to create a basic summary using JavaScript.

The fallback method:

1. Cleans the text.
2. Splits it into sentences.
3. Finds frequent keywords.
4. Scores sentences.
5. Picks the best sentences.

This is called extractive summarisation because it extracts important sentences from the original paper.

The LLM summary is better because it can understand meaning, but the fallback is useful for demonstration.

## 12. Difference Between Extractive and Abstractive Summarisation

### Extractive Summarisation

It selects important sentences directly from the original text.

Example:

```text
Original sentence from paper -> copied into summary
```

Advantages:

- Simple
- Fast
- Less chance of changing meaning

Disadvantages:

- May not be very smooth
- Cannot explain deeply

### Abstractive Summarisation

It understands the text and writes a new summary in its own words.

This is what an LLM does.

Advantages:

- More readable
- Better explanation
- Can organize information

Disadvantages:

- May sometimes hallucinate
- Needs API key or model
- Costs money if using paid API

## 13. Important Files Explained

### `index.html`

This file contains the structure of the web app.

It includes:

- Upload area
- Text area
- Summary length buttons
- Summarise button
- Output sections

### `styles.css`

This file designs the web app.

It makes the app look clean and modern.

### `app.js`

This file contains frontend logic.

It:

- Reads uploaded files
- Extracts PDF text using PDF.js
- Sends text to backend
- Displays summary
- Uses fallback summariser if LLM fails

### `server.js`

This is the backend.

It:

- Serves frontend files
- Reads `.env`
- Provides `/api/health`
- Provides `/api/summarize`
- Sends prompt to Gemini
- Returns summary JSON

### `.env`

This file stores private configuration.

It contains:

```text
LLM_PROVIDER=gemini
LLM_API_KEY=secret_key
LLM_MODEL=gemini-2.5-flash
PORT=3001
```

This file should not be shared publicly.

### `.gitignore`

This file tells git which files not to upload.

It ignores:

- `.env`
- `node_modules`
- `.DS_Store`

### `extension/manifest.json`

This file tells Chrome about the extension.

It defines:

- Extension name
- Version
- Popup file
- Permissions
- Backend URL permissions

### `extension/popup.js`

This is the brain of the Chrome extension.

It:

- Scans current web page
- Detects research paper text
- Sends text to backend
- Shows summary

## 14. API Endpoints

### Health Check

```text
GET /api/health
```

This checks whether the backend is running.

Example response:

```json
{
  "ok": true,
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "configured": true
}
```

### Summarise API

```text
POST /api/summarize
```

Request:

```json
{
  "text": "research paper text here",
  "length": "medium"
}
```

Response:

```json
{
  "title": "Paper title",
  "keywords": ["AI", "ML"],
  "abstract": "Short summary",
  "contributions": ["Contribution 1"],
  "methodology": "Method explanation",
  "findings": "Result explanation",
  "notes": ["Study note"]
}
```

## 15. Full Data Flow

```text
User opens web app or extension
        |
User provides or auto-detects paper text
        |
Frontend sends text to Node backend
        |
Backend creates prompt
        |
Backend sends request to Gemini API
        |
Gemini returns JSON summary
        |
Backend sends JSON to frontend
        |
Frontend displays summary
```

## 16. How to Explain This Project in Viva

You can say:

```text
My project is an AI-powered research paper summariser. It has a web app and Chrome extension. The web app allows users to upload or paste research paper text. The Chrome extension automatically detects research paper content from a website. The text is sent to a Node.js backend, which securely calls the Gemini LLM API. The LLM returns a structured JSON summary containing title, keywords, abstract summary, contributions, methodology, findings, and study notes. The result is displayed in a clean user interface.
```

## 17. Simple Real-Life Example

Imagine a student has a 10-page research paper about machine learning in healthcare.

Without this project:

- Student reads all 10 pages.
- Student spends 1-2 hours understanding it.
- Student manually writes notes.

With this project:

- Student opens the paper page.
- Clicks Chrome extension.
- Clicks Summarise.
- Gets key points in seconds.

## 18. Advantages

- Saves time
- Easy to use
- Works as web app and Chrome extension
- Uses modern LLM technology
- Gives structured output
- API key is stored in backend, not frontend
- Has fallback summarisation in web app

## 19. Limitations

- Needs internet for LLM API
- Needs a valid API key
- Some PDF viewers block Chrome extension text extraction
- LLM may sometimes make mistakes
- Very long papers may need chunking for best results
- Scanned PDFs need OCR before text can be extracted

## 20. Future Improvements

- Add OCR for scanned PDFs
- Add chat with paper feature
- Add citation extraction
- Add reference summarisation
- Add download summary as PDF
- Add user login and history
- Add multilingual summaries
- Add comparison of multiple papers
- Add plagiarism-safe paraphrasing
- Add backend database storage
- Add chunking for very long papers

## 21. Follow-Up Questions and Answers

### Q1. What is the main aim of this project?

The main aim is to help users quickly understand long research papers by generating structured summaries using an LLM.

### Q2. What problem does this project solve?

It solves the problem of spending too much time reading and understanding lengthy research papers.

### Q3. Which AI model is used?

The project uses the Gemini LLM API through a Node.js backend.

### Q4. Why did you use a backend?

The backend protects the API key. If the key were placed in frontend code, users could inspect and copy it.

### Q5. What is an LLM?

An LLM, or Large Language Model, is an AI model that can understand and generate human-like text.

### Q6. What is Gemini?

Gemini is a family of LLMs by Google. In this project, it is used to summarise research paper text.

### Q7. What is the role of JavaScript in this project?

JavaScript handles user interaction, file reading, API calls, page scanning in the extension, and rendering the summary.

### Q8. What is the role of Node.js?

Node.js runs the backend server, handles API routes, reads environment variables, and calls the Gemini API.

### Q9. What is prompt engineering?

Prompt engineering is the process of writing clear instructions for the AI model to get useful and structured output.

### Q10. Why does the project ask the LLM to return JSON?

JSON is easy for JavaScript to read. It lets the app place title, keywords, methodology, and findings in separate UI sections.

### Q11. What is the difference between web app and Chrome extension?

The web app works through a normal browser page where users upload or paste text. The Chrome extension works directly on research paper websites and detects content automatically.

### Q12. How does the Chrome extension detect research papers?

It scans the current page for selected text, metadata, article content, abstract sections, and research-related keywords like abstract, methodology, results, DOI, and references.

### Q13. Can the extension read every PDF?

No. Some browser PDF viewers block extension access. In such cases, users should open the paper's HTML page or select text manually.

### Q14. What is PDF.js?

PDF.js is a JavaScript library that extracts text from PDF files in the browser.

### Q15. What happens if the LLM API fails?

The web app uses a local extractive fallback summariser. The extension shows an error message and asks the user to check the backend or API key.

### Q16. What is extractive summarisation?

Extractive summarisation selects important sentences from the original text.

### Q17. What is abstractive summarisation?

Abstractive summarisation writes a new summary in its own words after understanding the text.

### Q18. Which type of summarisation does Gemini perform?

Gemini performs abstractive summarisation.

### Q19. Why is LLM summarisation better than simple keyword-based summarisation?

LLMs can understand context, meaning, and relationships between ideas. Keyword methods mostly count words and select sentences.

### Q20. Can the LLM make mistakes?

Yes. LLMs can hallucinate or misinterpret text. That is why the prompt tells it not to invent metrics.

### Q21. What is hallucination in AI?

Hallucination means the AI generates information that sounds correct but is not actually present or true.

### Q22. How can hallucination be reduced?

By giving clear prompts, asking the model not to invent details, using source text carefully, and verifying important facts manually.

### Q23. What is an API?

An API is a way for two software systems to communicate. Here, our backend communicates with Gemini through an API.

### Q24. What is an API key?

An API key is like a password that allows our project to use the Gemini service.

### Q25. Why should the API key be hidden?

If someone steals the key, they can use it and cause cost or misuse. So it should stay in `.env` and not be uploaded publicly.

### Q26. What is `.env`?

`.env` is a file used to store private settings like API keys, model names, and port numbers.

### Q27. What is `.gitignore`?

`.gitignore` tells git which files should not be tracked or uploaded.

### Q28. What is CORS?

CORS is a browser security rule that controls which websites can call a backend. This project sets CORS headers so the Chrome extension can call the local backend.

### Q29. What is localhost?

Localhost means the project is running on your own computer.

### Q30. What is port 3001?

Port 3001 is the local address where the Node.js backend runs.

### Q31. Why not call Gemini directly from the Chrome extension?

Because then the API key would be inside the extension code and could be copied.

### Q32. What permissions does the Chrome extension use?

It uses permissions like `activeTab` and `scripting` to scan the current page when the popup is opened.

### Q33. Is this project safe?

It is safer than putting the API key in frontend code, but for production it should also include authentication, rate limiting, and stricter CORS.

### Q34. What is rate limiting?

Rate limiting means controlling how many requests a user can send in a specific time to prevent misuse.

### Q35. Can this project be deployed online?

Yes. The frontend and backend can be deployed, but the API key must be stored securely in server environment variables.

### Q36. What would you improve before production?

I would add authentication, rate limiting, proper error logging, database history, chunking for long papers, OCR, and stronger security.

### Q37. What is chunking?

Chunking means splitting a long paper into smaller parts so the LLM can process it better.

### Q38. Why is chunking useful?

LLMs have input limits. Very long papers may exceed those limits, so chunking helps process them safely.

### Q39. What is OCR?

OCR means Optical Character Recognition. It converts scanned images of text into real editable text.

### Q40. Why is OCR needed?

Some PDFs are scanned images, not real text. PDF.js cannot extract text from scanned images, so OCR is needed.

### Q41. Can this project support multiple languages?

Yes. Gemini can summarise in multiple languages if the prompt is updated.

### Q42. Can it summarise YouTube videos?

Not in the current version. It would need transcript extraction first.

### Q43. Can it compare two papers?

Not currently, but it can be added by sending both papers to the backend and asking the LLM to compare them.

### Q44. What is the best feature of this project?

The Chrome extension auto-detects research paper content from websites and summarises it without manual copy-paste.

### Q45. What is the biggest limitation?

The biggest limitation is dependence on the LLM API and the quality of extracted text.

### Q46. What is the input of the project?

The input is research paper text from upload, paste, PDF extraction, selected text, or website detection.

### Q47. What is the output of the project?

The output is a structured summary containing title, keywords, abstract summary, contributions, methodology, findings, and notes.

### Q48. Which programming language is mainly used?

JavaScript is mainly used for both frontend and backend.

### Q49. Why use JavaScript for backend too?

Using JavaScript with Node.js allows the whole project to use one language for frontend, backend, and extension.

### Q50. How will you explain the project in one sentence?

It is an AI-powered web app and Chrome extension that uses Gemini to automatically summarise research papers into easy study notes.

## 22. Short Presentation Script

Good morning respected teachers and friends.

My project is called Research Paper Summariser. It is an AI-powered web application and Chrome extension that helps students understand research papers quickly.

The problem is that research papers are usually long, technical, and time-consuming to read. My project solves this by using an LLM API to generate a structured summary.

The user can either upload or paste a research paper in the web app, or open a research paper website and use the Chrome extension. The extension automatically detects paper content from the site. After clicking Summarise, the text is sent to a Node.js backend. The backend securely calls the Gemini API and receives a JSON summary.

The summary includes title, keywords, abstract summary, key contributions, methodology, findings, and study notes.

The main technologies used are HTML, CSS, JavaScript, Node.js, Gemini API, PDF.js, and Chrome Extension APIs.

This project is useful for students, researchers, and anyone who wants to understand research papers faster.

In the future, I can improve this project by adding OCR, chat with paper, citation extraction, summary download, and comparison of multiple papers.

Thank you.

## 23. Commands to Run the Project

Start the backend:

```bash
npm start
```

Open the web app:

```text
http://127.0.0.1:3001
```

Load Chrome extension:

```text
chrome://extensions -> Developer Mode -> Load unpacked -> select extension folder
```

## 24. Final Simple Explanation

This project is like a smart study helper.

You give it a research paper.

It reads the paper using AI.

Then it gives you simple notes.

The web app is for uploading or pasting papers.

The Chrome extension is for summarising papers directly from websites.

The backend protects the secret API key and talks to Gemini.

That is the whole project.

## 25. File-by-File Explanation

This section explains what each file does and what the code inside it means.

## 26. `index.html` Explained

### What This File Is Used For

`index.html` is the main page of the web application.

It is responsible for the structure of the app.

It does not contain the main logic. It mainly defines what appears on the screen.

### Main Parts of `index.html`

### Head Section

The head section contains page settings.

It includes:

- Character encoding
- Mobile responsive viewport
- Page title
- Google font link
- CSS file link
- PDF.js script

Important line:

```html
<link rel="stylesheet" href="styles.css" />
```

This connects the design file to the HTML page.

Another important line:

```html
<script src="app.js" type="module"></script>
```

This connects the JavaScript logic to the page.

### Main App Shell

The main app is inside:

```html
<main class="app-shell">
```

This is the outer wrapper of the web app.

### Input Panel

The input panel contains:

- Project title
- Upload area
- Text area
- Summary length buttons
- Summarise button

Important upload input:

```html
<input id="fileInput" type="file" accept=".txt,.pdf,application/pdf,text/plain" />
```

This lets users upload PDF or TXT files.

Important text area:

```html
<textarea id="paperText"></textarea>
```

This is where pasted or extracted paper text appears.

Important buttons:

```html
<button class="chip active" data-length="short">Short</button>
<button class="chip" data-length="medium">Medium</button>
<button class="chip" data-length="detailed">Detailed</button>
```

These buttons allow the user to choose summary length.

Important summarise button:

```html
<button id="summariseBtn" class="primary-btn" type="button">Summarise</button>
```

When this button is clicked, JavaScript sends the paper text to the backend.

### Output Panel

The output panel contains sections for:

- Title guess
- Keywords
- Abstract summary
- Key contributions
- Methodology
- Findings
- Study notes

Example:

```html
<p id="abstractSummary">Your concise summary will appear here.</p>
```

JavaScript later changes this text and places the actual summary here.

## 27. `styles.css` Explained

### What This File Is Used For

`styles.css` controls the look and layout of the web app.

It makes the app:

- Clean
- Responsive
- Modern
- Easy to read

### CSS Variables

At the top, there is:

```css
:root {
  --ink: #1d2433;
  --muted: #667085;
  --line: #d9e1e8;
}
```

These are reusable color variables.

Instead of writing the same color again and again, we use variables like:

```css
color: var(--ink);
```

### Global Style

```css
* {
  box-sizing: border-box;
}
```

This makes sizing easier and prevents layout problems.

### Body Style

The `body` style sets:

- Page background
- Font
- Text color
- Full page height

### Layout

Important class:

```css
.workspace {
  display: grid;
  grid-template-columns: minmax(340px, 0.95fr) minmax(440px, 1.25fr);
}
```

This creates a two-column layout:

- Left side for input
- Right side for output

### Panels

```css
.panel {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
}
```

This makes the input and output areas look like clean panels.

### Upload Zone

The upload zone style creates the dashed box where users upload PDF or TXT files.

```css
.upload-zone label {
  border: 1.5px dashed #93b7aa;
}
```

### Buttons

The `.chip` class styles short, medium, and detailed buttons.

The `.primary-btn` class styles the main Summarise button.

### Responsive Design

At the bottom, media queries are used:

```css
@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
```

This means on smaller screens, the two-column layout becomes one column.

## 28. `app.js` Explained

### What This File Is Used For

`app.js` is the frontend brain of the web app.

It handles:

- Reading user input
- Reading uploaded files
- Extracting PDF text
- Sending text to backend
- Showing output
- Running fallback summarisation

### Selecting HTML Elements

At the top:

```js
const paperText = document.querySelector("#paperText");
const fileInput = document.querySelector("#fileInput");
const summariseBtn = document.querySelector("#summariseBtn");
```

This finds HTML elements by their IDs so JavaScript can control them.

For example:

```js
paperText.value
```

gets the text inside the text area.

### Output Object

```js
const output = {
  title: document.querySelector("#titleGuess"),
  keywords: document.querySelector("#keywords"),
  abstract: document.querySelector("#abstractSummary")
};
```

This stores all output elements in one object.

It makes the code easier to manage.

### Summary Length Buttons

```js
let selectedLength = "short";
```

This stores the current selected summary length.

When the user clicks short, medium, or detailed, the value changes.

### File Upload Logic

```js
fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await loadFile(file);
});
```

This means:

When a user selects a file, call `loadFile(file)`.

### Drag and Drop Logic

The code also allows users to drag and drop a file into the upload area.

Events used:

- `dragenter`
- `dragover`
- `dragleave`
- `drop`

### Summarise Button Logic

Important code:

```js
summariseBtn.addEventListener("click", async () => {
  const text = cleanText(paperText.value);
});
```

When the Summarise button is clicked:

1. The text is cleaned.
2. The app checks if text is long enough.
3. It tries LLM summarisation.
4. If LLM fails, it uses local fallback summarisation.

### LLM API Call

```js
async function summariseWithApi(text, length) {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, length }),
  });
}
```

This sends paper text to the backend.

`fetch` is used to make an HTTP request.

### Reading PDF Files

```js
async function readPdf(file) {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
}
```

This imports PDF.js.

PDF.js reads each page of the PDF and extracts text.

### Local Fallback Summariser

If the LLM fails, this function is used:

```js
function summarisePaper(text, length) {
```

It does basic summarisation without AI API.

It:

1. Splits text into sections.
2. Splits text into sentences.
3. Finds keywords.
4. Scores sentences.
5. Selects top sentences.

### Keyword Extraction

```js
function topKeywords(text, limit) {
```

This function:

- Converts text to lowercase
- Removes symbols
- Removes common stop words
- Counts important words
- Returns top keywords

### Sentence Ranking

```js
function rankSentences(sentences, keywords) {
```

This gives a score to each sentence.

Sentences get higher scores if:

- They contain important keywords
- They contain research words like method, result, model, dataset
- They appear near the beginning

### Rendering Summary

```js
function renderSummary(summary) {
  output.title.textContent = summary.title;
}
```

This function shows the final summary on the page.

It fills the HTML output sections.

### Escape HTML

```js
function escapeHtml(value) {
```

This prevents unsafe HTML from being inserted into the page.

It is a small security protection.

## 29. `server.js` Explained

### What This File Is Used For

`server.js` is the backend of the project.

It does three main jobs:

1. Serves the web app files.
2. Provides API routes.
3. Calls the Gemini LLM API.

### Import Statements

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
```

These are Node.js built-in modules.

- `http` creates a web server
- `fs/promises` reads files
- `path` helps with file paths
- `url` helps with file URLs

### Loading `.env`

```js
await loadEnv();
```

This loads secret values from `.env`.

The API key is stored there.

### LLM Configuration

```js
const llmConfig = {
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL,
  provider: process.env.LLM_PROVIDER
};
```

This stores:

- API key
- Model name
- Provider name

### Creating the Server

```js
createServer(async (request, response) => {
```

This creates the backend server.

Every request comes into this function.

### CORS Headers

```js
addCorsHeaders(response);
```

This allows the Chrome extension to call the backend.

### Health API

```js
if (request.url === "/api/health") {
```

This route checks whether the backend is working.

It returns:

- `ok`
- provider
- model
- configured status

### Summarise API

```js
if (request.url === "/api/summarize" && request.method === "POST") {
```

This is the main API endpoint.

The frontend and extension send paper text here.

### Handling Summarisation

```js
async function handleSummarize(request, response) {
```

This function:

1. Checks if API key exists.
2. Reads request body.
3. Extracts text and length.
4. Checks text length.
5. Calls the LLM.
6. Sends JSON response.

### Calling the Correct LLM

```js
async function callLlm(text, length) {
  if (llmConfig.provider === "gemini") return callGemini(text, length);
  return callOpenAiCompatible(text, length);
}
```

This chooses which provider to use.

Currently, the project uses Gemini.

### Gemini API Call

```js
async function callGemini(text, length) {
```

This function sends the paper text to Gemini.

Important endpoint:

```js
https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent
```

This is the Gemini generate content API.

### Gemini Headers

```js
headers: {
  "Content-Type": "application/json",
  "x-goog-api-key": llmConfig.apiKey,
}
```

This sends the API key securely from the backend.

### Gemini Prompt

```js
const prompt = buildSummaryPrompt(text, length);
```

This builds the instruction that tells Gemini what to do.

### JSON Response Mode

```js
generationConfig: {
  temperature: 0.2,
  responseMimeType: "application/json",
}
```

This asks Gemini to return JSON.

Low temperature means the response should be more focused and less random.

### Normalising Summary

```js
function normaliseSummary(summary) {
```

This makes sure the output always has the expected fields.

If a field is missing, it uses a fallback value.

### Serving Static Files

```js
async function serveStatic(request, response) {
```

This serves files like:

- `index.html`
- `styles.css`
- `app.js`

So the same Node server runs both frontend and backend.

### Reading Request Body

```js
function readBody(request) {
```

This reads JSON data sent from the frontend.

### Sending JSON Response

```js
function sendJson(response, status, payload) {
```

This sends API responses in JSON format.

## 30. `package.json` Explained

### What This File Is Used For

`package.json` describes the Node.js project.

It includes:

- Project name
- Version
- Scripts
- Description
- Keywords

### Important Script

```json
"start": "node server.js"
```

This means when we run:

```bash
npm start
```

Node runs:

```bash
node server.js
```

### Type Module

```json
"type": "module"
```

This allows the project to use modern JavaScript imports:

```js
import { createServer } from "node:http";
```

## 31. `.env` Explained

### What This File Is Used For

`.env` stores private configuration.

It contains the API key.

Example:

```text
LLM_PROVIDER=gemini
LLM_API_KEY=secret_key
LLM_MODEL=gemini-2.5-flash
PORT=3001
```

### Why This File Is Important

The API key should not be placed in frontend code.

The `.env` file keeps it on the backend side.

### Important Warning

Do not upload `.env` to GitHub.

## 32. `.env.example` Explained

### What This File Is Used For

`.env.example` is a sample file.

It shows other developers what environment variables are needed.

It does not contain the real API key.

This file is safe to share.

## 33. `.gitignore` Explained

### What This File Is Used For

`.gitignore` tells git to ignore private or unnecessary files.

In this project:

```text
.env
node_modules/
.DS_Store
```

This means:

- Do not upload `.env`
- Do not upload installed packages
- Do not upload Mac system files

## 34. `README.md` Explained

### What This File Is Used For

`README.md` is the quick guide for the project.

It explains:

- Project overview
- Features
- Tech stack
- How it works
- How to run it
- How to load the Chrome extension

This is useful when someone opens your project folder for the first time.

## 35. `PROJECT_NOTES.md` Explained

### What This File Is Used For

This file is a detailed explanation document.

It is useful for:

- Viva preparation
- Project presentation
- Understanding the code
- Explaining the project to teachers
- Answering follow-up questions

It explains the project in simple language.

## 36. `extension/manifest.json` Explained

### What This File Is Used For

`manifest.json` is the main configuration file for the Chrome extension.

Chrome reads this file to understand the extension.

### Manifest Version

```json
"manifest_version": 3
```

This means the extension uses Chrome Extension Manifest V3.

### Extension Name

```json
"name": "Research Paper Summariser"
```

This is the name shown in Chrome.

### Popup Configuration

```json
"action": {
  "default_popup": "popup.html"
}
```

This tells Chrome to open `popup.html` when the extension icon is clicked.

### Permissions

```json
"permissions": ["activeTab", "scripting", "storage"]
```

Meaning:

- `activeTab`: access the current tab after user clicks extension
- `scripting`: inject JavaScript into current page
- `storage`: store extension data if needed later

### Host Permissions

```json
"host_permissions": ["http://127.0.0.1:3001/*"]
```

This allows the extension to call the local backend.

## 37. `extension/popup.html` Explained

### What This File Is Used For

`popup.html` is the UI of the Chrome extension popup.

It appears when the user clicks the extension icon.

### Main UI Parts

It contains:

- Header
- Detection card
- Scan button
- Use Selection button
- Summary length dropdown
- Text area
- Summarise button
- Result section

### Detection Card

```html
<section class="detect-card">
```

This shows whether a research paper was detected.

It displays:

- Detection status
- Paper title
- Word count or message

### Scan Button

```html
<button id="detectBtn" type="button">Scan</button>
```

This lets the user scan the current page again.

### Text Area

```html
<textarea id="paperText"></textarea>
```

Detected paper text appears here.

The user can also paste text manually.

### Result Section

```html
<section id="result" hidden>
```

This section is hidden at first.

After summarisation, JavaScript shows it.

## 38. `extension/popup.css` Explained

### What This File Is Used For

`popup.css` designs the Chrome extension popup.

It controls:

- Popup width
- Colors
- Buttons
- Detection card
- Text area
- Result layout

### Body Width

```css
body {
  width: 390px;
}
```

Chrome extension popups are small, so we set a fixed width.

### Detection Card Style

```css
.detect-card {
  display: grid;
  grid-template-columns: 1fr 62px;
}
```

This makes the detection info and Scan button appear side by side.

### Button Styles

Buttons are styled with:

```css
button,
select {
  min-height: 38px;
  border-radius: 8px;
}
```

This makes buttons easy to click.

### Result Styles

The result section has:

```css
#result {
  border-top: 1px solid var(--line);
}
```

This visually separates output from input.

## 39. `extension/popup.js` Explained

### What This File Is Used For

`popup.js` is the main logic of the Chrome extension.

It:

- Automatically scans the current web page
- Detects research paper content
- Uses selected text if needed
- Sends text to backend
- Displays the LLM summary

### API URL

```js
const apiUrl = "http://127.0.0.1:3001/api/summarize";
```

This is the backend endpoint used by the extension.

### Selecting Popup Elements

```js
const paperText = document.querySelector("#paperText");
const detectBtn = document.querySelector("#detectBtn");
const summariseBtn = document.querySelector("#summariseBtn");
```

This gets popup elements so JavaScript can control them.

### Auto Scan on Popup Open

```js
document.addEventListener("DOMContentLoaded", detectPaperOnCurrentTab);
```

This means:

As soon as the popup opens, scan the current webpage.

### Manual Scan Button

```js
detectBtn.addEventListener("click", detectPaperOnCurrentTab);
```

This lets the user scan again.

### Use Selection Button

```js
selectionBtn.addEventListener("click", async () => {
```

This gets the text selected by the user on the current webpage.

### Chrome Scripting API

```js
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => window.getSelection().toString(),
});
```

This runs JavaScript inside the current webpage.

It extracts selected text from the page.

### Summarise Button

```js
summariseBtn.addEventListener("click", async () => {
```

When clicked:

1. It gets detected or pasted text.
2. It checks if text is long enough.
3. It sends text to backend.
4. It displays summary.

### Automatic Paper Detection

```js
async function detectPaperOnCurrentTab() {
```

This scans the active browser tab.

It injects this function into the current page:

```js
extractResearchPaperFromPage
```

### Page Extraction Function

```js
function extractResearchPaperFromPage() {
```

This function runs inside the website page.

It looks for:

- Selected text
- Metadata
- Page title
- Abstract
- Article tags
- Main content
- Body text

### Metadata Reading

```js
const meta = (name) =>
  clean(document.querySelector(`meta[name="${name}"]`)?.content);
```

This reads metadata from the page.

Research paper websites often include metadata like:

- `citation_title`
- `citation_abstract`
- `description`

### Finding the Title

```js
const title =
  meta("citation_title") ||
  meta("dc.Title") ||
  clean(document.querySelector("h1")?.innerText) ||
  clean(document.title);
```

This tries multiple ways to find the paper title.

### Finding Abstract

```js
const abstract =
  meta("citation_abstract") ||
  meta("description") ||
  clean(document.querySelector(".abstract, #abstract")?.innerText);
```

This tries to find the abstract section.

### Candidate Selectors

```js
const selectors = [
  "article",
  "main",
  "[role='main']",
  ".article",
  ".paper",
  "body",
];
```

These are areas where paper text is likely to exist.

### Collecting Readable Text

```js
function collectReadableText(root) {
```

This collects readable text from paragraphs, headings, list items, sections, and divs.

It skips useless areas like:

- scripts
- styles
- navbars
- headers
- footers
- forms

### Scoring Paper Text

```js
function scorePaperText(text) {
```

This checks whether the page looks like a research paper.

It searches for words like:

- abstract
- introduction
- methodology
- results
- references
- DOI
- arXiv
- dataset
- accuracy

The more signals it finds, the higher the score.

### Deciding If It Is a Paper

```js
function looksLikePaper(text) {
  return scorePaperText(text) >= 7;
}
```

If the score is high enough, the extension says a paper was detected.

### Rendering Summary in Extension

```js
function renderSummary(summary) {
```

This displays the summary in the popup.

It fills:

- title
- keywords
- abstract
- contributions
- methodology
- findings

## 40. Simple Code Flow Summary

### Web App Code Flow

```text
index.html creates UI
styles.css designs UI
app.js handles click/upload
app.js sends text to /api/summarize
server.js receives request
server.js calls Gemini
Gemini returns JSON
app.js displays summary
```

### Chrome Extension Code Flow

```text
manifest.json tells Chrome about extension
popup.html creates popup UI
popup.css designs popup
popup.js scans current website
popup.js detects paper text
popup.js sends text to backend
server.js calls Gemini
popup.js displays summary
```

## 41. Very Simple Explanation of Each File

```text
index.html       = skeleton of web app
styles.css       = clothes/design of web app
app.js           = brain of web app
server.js        = backend brain and Gemini connector
package.json     = project start command file
.env             = secret key storage
.env.example     = sample config file
.gitignore       = files git should ignore
README.md        = quick guide
PROJECT_NOTES.md = full explanation notes
manifest.json    = Chrome extension identity card
popup.html       = extension popup skeleton
popup.css        = extension popup design
popup.js         = extension popup brain
```
