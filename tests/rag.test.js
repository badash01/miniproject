import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RagStore, chunkPages } from "../lib/rag.js";

// Deterministic embeddings isolate retrieval and persistence from model downloads.
const embed = async (texts) =>
  texts.map((text) =>
    text.includes("orchard")
      ? [1, 0, 0]
      : text.includes("solar")
        ? [0, 1, 0]
        : [0, 0, 1],
  );

test("named assignments receive full ordered coverage without unrelated documents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rag-coverage-"));
  try {
    const store = await new RagStore(directory, embed).init();
    const assignment = await store.add({
      name: "assignmentcg.pdf",
      pages: [
        Array.from(
          { length: 10 },
          (_, i) =>
            `Q${i + 1}. Explain topic ${i + 1} and provide examples. ${"Supporting assignment details. ".repeat(20)}`,
        ).join(" "),
      ],
    });
    const module = await store.add({
      name: "Module1PDF.pdf",
      pages: [
        "Q99. Unrelated module material about renewable energy and historical archives.",
      ],
    });
    const context = await store.retrieveContext(
      "how may questions in assignmentcg",
    );
    assert.equal(context.intent, "question_count");
    assert.equal(context.coverage.complete, true);
    assert.ok(context.sources.length > 1);
    assert.ok(context.sources.every((s) => s.documentId === assignment.id));
    assert.ok(context.sources.some((s) => s.text.includes("Q10.")));
    assert.deepEqual(
      context.sources.map((s) => s.position),
      context.sources.map((s) => s.position).toSorted((a, b) => a - b),
    );
    const summary = await store.retrieveContext("summary of assignmentcg.pdf");
    assert.equal(summary.coverage.complete, true);
    assert.equal(summary.sources.length, context.sources.length);
    await assert.rejects(
      () =>
        store.retrieveContext("summary of assignmentcg", {
          documentIds: [module.id],
        }),
      /named document is not selected/,
    );

    await store.add({
      name: "large-assignment.txt",
      pages: Array.from(
        { length: 45 },
        (_, i) =>
          `Q${i + 1}. This distinct page contains enough supporting details about topic ${i + 1} for extraction.`,
      ),
    });
    const large = await store.retrieveContext(
      "how many questions in large-assignment",
    );
    assert.equal(large.coverage.complete, false);
    assert.equal(large.coverage.total, 45);
    assert.ok(large.sources.length <= 40);
    assert.ok(large.sources.some((s) => s.text.includes("Q45.")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("configured passage limit rejects new documents without partial writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rag-limit-"));
  try {
    const store = await new RagStore(directory, embed, { maxChunks: 1 }).init();
    await store.add({
      name: "First",
      pages: [
        "Solar energy powers irrigation systems on farms and supports renewable energy generation.",
      ],
    });
    await assert.rejects(
      () =>
        store.add({
          name: "Second",
          pages: [
            "Wind energy powers irrigation pumps and supports sustainable agriculture on rural farms.",
          ],
        }),
      /Workspace limit is 1 passages/,
    );
    assert.equal(store.documents().length, 1);
    const reopened = await new RagStore(directory, embed, {
      maxChunks: 1,
    }).init();
    assert.equal(reopened.documents().length, 1);
    assert.equal(reopened.documents()[0].name, "First");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("chunking preserves page provenance, overlap and final short pages", () => {
  const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
  const chunks = chunkPages([words, "Final page."]);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[1].text.split(" ")[0], "word145");
  assert.equal(chunks[2].page, 2);
});
test("multi-document vector persistence, scope, deduplication and graph cleanup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "graph-rag-"));
  try {
    const store = await new RagStore(directory, embed).init();
    const a = await store.add({
      name: "Orchard.txt",
      pages: [
        "The orchard uses renewable energy. Renewable energy supports irrigation systems and sustainable agriculture.",
      ],
    });
    const b = await store.add({
      name: "Solar.txt",
      pages: [
        "The solar farm provides renewable energy. Renewable energy powers irrigation systems throughout the region.",
      ],
    });
    const c = await store.add({
      name: "Archives.txt",
      pages: [
        "Historical archives record ancient trading routes and the development of maritime navigation methods.",
      ],
    });
    assert.equal(store.documents().length, 3);
    assert.equal(
      (
        await store.add({
          name: "copy.txt",
          pages: [
            "The orchard uses renewable energy. Renewable energy supports irrigation systems and sustainable agriculture.",
          ],
        })
      ).duplicate,
      true,
    );
    const matches = await store.retrieve("orchard", { mode: "vector" });
    assert.equal(matches[0].documentId, a.id);
    assert.ok(!matches.some((m) => m.documentId === b.id));
    const scoped = await store.retrieve("solar", {
      documentIds: [b.id],
      mode: "hybrid",
    });
    assert.ok(scoped.length);
    assert.ok(scoped.every((s) => s.documentId === b.id));
    assert.ok(store.graphView().edges.some((e) => e.source === a.id));
    assert.ok(store.graphView().nodes.some((n) => n.type === "concept"));
    const graphMatches = await store.retrieve("orchards", { mode: "hybrid" });
    assert.ok(graphMatches.some((m) => m.documentId === b.id));
    assert.ok(
      graphMatches.find((m) => m.documentId === b.id).via.startsWith("graph:"),
    );
    assert.ok(graphMatches.every((m) => m.documentId !== c.id));
    const reopened = await new RagStore(directory, embed).init();
    assert.equal(reopened.documents().length, 3);
    assert.equal((await reopened.retrieve("orchard"))[0].name, "Orchard.txt");
    assert.equal(await reopened.remove(a.id), true);
    assert.ok(!reopened.graph.hasNode(a.id));
    assert.ok(
      (await reopened.retrieve("orchard")).every((s) => s.documentId !== a.id),
    );
    await assert.rejects(() =>
      reopened.retrieve("solar", { documentIds: ["' OR 1=1"] }),
    );
    await reopened.remove(b.id);
    await reopened.remove(c.id);
    assert.deepEqual(await reopened.retrieve("orchard"), []);
    await reopened.add({
      name: "Restored",
      pages: [
        "The orchard uses renewable energy. Renewable energy supports irrigation systems and sustainable agriculture.",
      ],
    });
    assert.equal(reopened.documents().length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
