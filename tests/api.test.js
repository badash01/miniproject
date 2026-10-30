import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RagStore } from "../lib/rag.js";
import { ragApi } from "../lib/rag-api.js";

test("HTTP multi-file ingestion, evidence citations, selection and deletion", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rag-api-"));
  const store = await new RagStore(directory, async (texts) =>
    texts.map(() => [1, 0, 0]),
  ).init();
  let configured = false;
  const handle = ragApi({
    store,
    configured: () => configured,
    generate: async () => "Solar energy powers the irrigation pumps. [1]",
    json: (res, code, data) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    },
    readBody: async (req) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      return body;
    },
  });
  const server = createServer(async (req, res) => {
    if (!(await handle(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const form = new FormData();
    form.append(
      "documents",
      new Blob([
        "Solar energy powers the irrigation pumps. Renewable energy improves the efficiency of sustainable farms.",
      ]),
      "solar.txt",
    );
    form.append(
      "documents",
      new Blob([
        "Wind turbines generate renewable electricity. The electricity powers irrigation systems on nearby farms.",
      ]),
      "wind.md",
    );
    form.append("documents", new Blob(["Unsupported file"]), "bad.exe");
    const uploaded = await (
      await fetch(`${base}/api/documents`, { method: "POST", body: form })
    ).json();
    assert.equal(uploaded.results.length, 3);
    assert.ok(
      uploaded.results.find((result) => result.name === "bad.exe").error,
    );
    const library = await (await fetch(`${base}/api/documents`)).json();
    assert.equal(library.documents.length, 2);
    const ask = async (ids) =>
      (
        await fetch(`${base}/api/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "What powers irrigation?",
            documentIds: ids,
            mode: "hybrid",
          }),
        })
      ).json();
    const evidence = await ask([]);
    assert.equal(evidence.generated, false);
    assert.equal(evidence.sources.length, 2);
    assert.match(evidence.answer, /\[1\]/);
    const scoped = await ask([library.documents[0].id]);
    assert.equal(scoped.sources.length, 1);
    configured = true;
    assert.equal((await ask([])).generated, true);
    const deleted = await fetch(
      `${base}/api/documents/${library.documents[0].id}`,
      { method: "DELETE" },
    );
    assert.equal(deleted.status, 200);
    assert.equal(
      (await (await fetch(`${base}/api/documents`)).json()).documents.length,
      1,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
