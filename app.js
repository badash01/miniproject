const $ = (selector) => document.querySelector(selector);
let documents = [],
  selected = new Set(),
  mode = "hybrid",
  graph,
  turnId = 0,
  indexing = false,
  asking = false;
const icons = () => window.lucide?.createIcons();
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      payload.message ||
        payload.results?.map((r) => r.error).join("\n") ||
        "Request failed.",
    );
  return payload;
}
function status(selector, message, error = false) {
  $(selector).textContent = message;
  $(selector).classList.toggle("error", error);
}
function controls() {
  $("#askButton").disabled =
    asking || indexing || !documents.length || !selected.size;
  for (const id of ["files", "saveText", "pasteButton"])
    $(`#${id}`).disabled = indexing;
  $("#allDocuments").checked =
    !!documents.length && selected.size === documents.length;
  $("#allDocuments").indeterminate =
    selected.size > 0 && selected.size < documents.length;
  $("#scope").textContent =
    selected.size === documents.length
      ? "All documents"
      : `${selected.size} selected`;
}
async function refresh() {
  const [library, health] = await Promise.all([
    api("/api/documents"),
    api("/api/health"),
  ]);
  const old = new Set(documents.map((d) => d.id));
  documents = library.documents;
  selected = new Set(
    documents
      .filter((d) => selected.has(d.id) || !old.has(d.id))
      .map((d) => d.id),
  );
  $("#documentCount").textContent = documents.length;
  $("#chunkCount").textContent = `${library.chunks} passages`;
  $("#connection").textContent = health.configured
    ? "Connected · LLM ready"
    : "Connected · Evidence only";
  $("#documents").innerHTML = documents.length
    ? documents
        .map(
          (d) =>
            `<div class="document"><input type="checkbox" data-select="${d.id}" ${selected.has(d.id) ? "checked" : ""} aria-label="Select ${escape(d.name)}"><div><div class="doc-name">${escape(d.name)}</div><small>${d.pages} page${d.pages === 1 ? "" : "s"} · ${d.chunks} passages</small></div><button class="icon-button" data-delete="${d.id}" title="Delete ${escape(d.name)}" aria-label="Delete ${escape(d.name)}"><i data-lucide="trash-2"></i></button></div>`,
        )
        .join("")
    : '<p class="document-empty">Your library is empty.</p>';
  if ($("#emptyMessage"))
    $("#emptyMessage").textContent = documents.length
      ? `${documents.length} documents · ${library.chunks} indexed passages`
      : "No documents indexed yet.";
  controls();
  icons();
  if (!$("#graphView").hidden) await renderGraph();
}
async function index(options) {
  if (indexing) return;
  indexing = true;
  controls();
  status(
    "#uploadStatus",
    "Indexing documents... First use downloads the embedding model.",
  );
  try {
    const result = await api("/api/documents", { method: "POST", ...options });
    status(
      "#uploadStatus",
      result.results
        .map(
          (r) =>
            `${r.name}: ${r.error || (r.duplicate ? "already indexed" : `${r.chunks} passages indexed`)}`,
        )
        .join("\n"),
      result.results.some((r) => r.error),
    );
    await refresh();
    return true;
  } catch (error) {
    status("#uploadStatus", error.message, true);
    return false;
  } finally {
    indexing = false;
    controls();
  }
}
async function upload(files) {
  if (!files.length) return;
  const data = new FormData();
  for (const file of files) data.append("documents", file);
  await index({ body: data });
  $("#files").value = "";
}
$("#files").addEventListener("change", (event) =>
  upload([...event.target.files]),
);
for (const name of ["dragenter", "dragover", "dragleave", "drop"])
  $("#dropZone").addEventListener(name, (event) => {
    event.preventDefault();
    $("#dropZone").classList.toggle(
      "dragging",
      ["dragenter", "dragover"].includes(name),
    );
    if (name === "drop") upload([...event.dataTransfer.files]);
  });
$("#pasteButton").onclick = () => $("#pasteDialog").showModal();
$("#closePaste").onclick = () => $("#pasteDialog").close();
$("#pasteForm").onsubmit = async (event) => {
  event.preventDefault();
  if (
    await index({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#documentName").value,
        text: $("#documentText").value,
      }),
    })
  ) {
    $("#pasteDialog").close();
    $("#pasteForm").reset();
  }
};
$("#documents").addEventListener("change", (event) => {
  const id = event.target.dataset.select;
  if (id) {
    event.target.checked ? selected.add(id) : selected.delete(id);
    controls();
  }
});
$("#documents").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button || indexing) return;
  button.disabled = true;
  try {
    await api(`/api/documents/${button.dataset.delete}`, { method: "DELETE" });
    await refresh();
  } catch (error) {
    status("#uploadStatus", error.message, true);
    button.disabled = false;
  }
});
$("#allDocuments").onchange = (event) => {
  selected = new Set(event.target.checked ? documents.map((d) => d.id) : []);
  document
    .querySelectorAll("[data-select]")
    .forEach((input) => (input.checked = selected.has(input.dataset.select)));
  controls();
};
document.querySelectorAll("[data-mode]").forEach(
  (button) =>
    (button.onclick = () => {
      mode = button.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((b) => b.classList.toggle("active", b === button));
    }),
);
document.querySelectorAll("[data-view]").forEach(
  (button) =>
    (button.onclick = async () => {
      document
        .querySelectorAll("[data-view]")
        .forEach((b) => b.classList.toggle("active", b === button));
      const isGraph = button.dataset.view === "graph";
      $("#graphView").hidden = !isGraph;
      $("#answersView").hidden = isGraph;
      if (isGraph) {
        try {
          await renderGraph();
        } catch (error) {
          $("#graphStats").textContent = error.message;
        }
      }
    }),
);
$("#clearChat").onclick = () => {
  if (!asking) {
    $("#conversation").replaceChildren();
    status("#answerStatus", "");
  }
};
$("#askForm").onsubmit = async (event) => {
  event.preventDefault();
  const question = $("#question").value.trim();
  if (!question || !selected.size || asking || indexing) return;
  asking = true;
  controls();
  status("#answerStatus", "Retrieving evidence...");
  const article = document.createElement("article");
  article.className = "turn";
  const id = ++turnId;
  $("#emptyChat")?.remove();
  article.innerHTML = `<h2 class="user-question">${escape(question)}</h2><div class="answer-label"><i data-lucide="sparkles"></i><span>Searching documents</span></div><div class="answer-body"></div>`;
  $("#conversation").append(article);
  icons();
  article.scrollIntoView({ block: "start", behavior: "smooth" });
  try {
    const payload = await api("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, mode, documentIds: [...selected] }),
    });
    article.querySelector(".answer-label span").textContent =
      payload.answerType === "document_count"
        ? "Verified document count"
        : payload.answerType === "insufficient_evidence"
          ? "Insufficient evidence"
          : payload.generated
            ? "Answer with sources"
            : "Retrieved evidence";
    const answer = escape(payload.answer).replace(
      /\[(\d+)\]/g,
      (match, number) =>
        payload.sources.some((s) => s.citation === Number(number))
          ? `<button class="citation" data-source="source-${id}-${number}" title="View source ${number}">[${number}]</button>`
          : match,
    );
    article.querySelector(".answer-body").innerHTML =
      `${payload.notice ? `<p class="notice">${escape(payload.notice)}</p>` : ""}<div class="answer-text">${answer}</div><details class="sources"><summary>${payload.sources.length} source passages</summary>${payload.sources.map((s) => `<div class="source" id="source-${id}-${s.citation}"><strong>[${s.citation}] ${escape(s.name)}</strong><small>Page ${s.page} · Passage ${s.position + 1} · ${escape(s.via)}${s.score == null ? "" : ` · Score ${s.score}`}</small><p>${escape(s.text)}</p></div>`).join("")}</details>`;
    $("#question").value = "";
    status("#answerStatus", "");
  } catch (error) {
    article.querySelector(".answer-label span").textContent = "Request failed";
    article.querySelector(".answer-body").textContent = error.message;
    status(
      "#answerStatus",
      "Your question is still in the input. You can retry.",
      true,
    );
  } finally {
    asking = false;
    controls();
  }
};
$("#conversation").addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (!button) return;
  const source = document.getElementById(button.dataset.source);
  source.closest("details").open = true;
  source.classList.add("highlight");
  source.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
async function renderGraph() {
  const data = await api("/api/graph");
  $("#graphStats").textContent =
    `${documents.length} documents · ${data.totalNodes} nodes · ${data.totalEdges} connections`;
  graph?.destroy();
  graph = window.cytoscape({
    container: $("#graph"),
    elements: [
      ...data.nodes.map((n) => ({
        data: {
          ...n,
          displayLabel: n.type === "document" ? n.label : "",
        },
      })),
      ...data.edges.map((e) => ({ data: e })),
    ],
    style: [
      {
        selector: "node",
        style: {
          label: "data(displayLabel)",
          "font-size": 10,
          color: "#475b4d",
          "text-wrap": "ellipsis",
          "text-max-width": 115,
          "text-valign": "bottom",
          "text-margin-y": 7,
          "background-color": "#c99740",
          width: 13,
          height: 13,
        },
      },
      {
        selector: 'node[type="document"]',
        style: {
          "background-color": "#17815d",
          width: 30,
          height: 30,
          "font-weight": "bold",
        },
      },
      {
        selector: "edge",
        style: { width: 1, "line-color": "#d1dcd5", "curve-style": "bezier" },
      },
      {
        selector: ":selected",
        style: { "border-width": 3, "border-color": "#243f2f" },
      },
    ],
    layout: {
      name: "cose",
      animate: false,
      padding: 55,
      nodeRepulsion: () => 10000,
    },
    minZoom: 0.15,
    maxZoom: 1.6,
  });
  graph.on("tap mouseover", "node", (event) => {
    const node = event.target;
    $("#graphDetail").textContent =
      `${node.data("label")} · ${node.degree()} connections`;
  });
}
$("#fitGraph").onclick = () => graph?.fit(undefined, 55);
window.addEventListener("resize", () => graph?.resize());
icons();
refresh().catch((error) => {
  $("#connection").textContent = "Backend unavailable";
  status("#uploadStatus", error.message, true);
});
