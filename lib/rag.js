import * as lancedb from "@lancedb/lancedb";
import { pipeline, env } from "@huggingface/transformers";
import Graph from "graphology";
import nlp from "compromise";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const stop = new Set(
  "this that these those their paper study result results method methods approach document research introduction conclusion abstract chapter figure table".split(
    " ",
  ),
);

export function chunkPages(pages, size = 180, overlap = 35) {
  const chunks = [];
  for (const [index, page] of pages.entries()) {
    const words = page.trim().split(/\s+/).filter(Boolean);
    for (let start = 0; start < words.length; start += size - overlap) {
      chunks.push({
        text: words.slice(start, start + size).join(" "),
        page: index + 1,
      });
      if (start + size >= words.length) break;
    }
  }
  return chunks;
}

export function concepts(text) {
  const counts = new Map();
  for (const phrase of nlp(text).nouns().out("array")) {
    const term = phrase
      .toLowerCase()
      .replace(/^(the|a|an|our|their|this|these)\s+/, "")
      .replace(/[^a-z0-9 -]/g, "")
      .trim();
    if (
      term.length < 4 ||
      term.length > 65 ||
      term.split(" ").length > 5 ||
      stop.has(term)
    )
      continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([term]) => term);
}

export function localEmbedder(cacheDir, { batchSize = 16, threads = 1 } = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 32)
    throw new Error("Embedding batch size must be between 1 and 32.");
  if (!Number.isInteger(threads) || threads < 1 || threads > 8)
    throw new Error("Embedding threads must be between 1 and 8.");
  env.cacheDir = cacheDir;
  let extractor;
  return async (texts) => {
    extractor ||= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
      session_options: {
        intraOpNumThreads: threads,
        interOpNumThreads: threads,
      },
    }).catch((error) => {
      extractor = undefined;
      throw new Error(
        `Could not load the embedding model. Check internet access for the first download. ${error.message}`,
      );
    });
    const model = await extractor;
    const result = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const output = await model(texts.slice(i, i + batchSize), {
        pooling: "mean",
        normalize: true,
      });
      result.push(...output.tolist());
    }
    return result;
  };
}

export class RagStore {
  constructor(directory, embed, { maxChunks = 10000 } = {}) {
    if (!Number.isInteger(maxChunks) || maxChunks < 1 || maxChunks > 10000)
      throw new Error("Passage limit must be between 1 and 10,000.");
    this.maxChunks = maxChunks;
    this.directory = directory;
    this.embed = embed;
    this.rows = [];
    this.graph = new Graph();
    this.pending = Promise.resolve();
  }

  async init() {
    await mkdir(this.directory, { recursive: true });
    this.db = await lancedb.connect(join(this.directory, "vectors"));
    if ((await this.db.tableNames()).includes("passages")) {
      this.table = await this.db.openTable("passages");
      this.rows = await this.table.query().limit(100000).toArray();
    }
    this.rebuildGraph();
    return this;
  }

  mutate(action) {
    const next = this.pending.then(action);
    this.pending = next.catch(() => {});
    return next;
  }

  async add({ name, pages }) {
    if (
      !Array.isArray(pages) ||
      !pages.length ||
      !pages.every((p) => typeof p === "string")
    )
      throw new Error("Document has no readable text.");
    const text = pages.join("\n").trim();
    if (text.length < 60)
      throw new Error(
        "Document needs at least 60 characters of readable text. Scanned PDFs need OCR.",
      );
    if (text.length > 1500000)
      throw new Error("Document exceeds the 1.5 million character limit.");
    const id = createHash("sha256")
      .update(text.replace(/\s+/g, " "))
      .digest("hex");
    return this.mutate(async () => {
      if (this.rows.some((r) => r.documentId === id))
        return { id, name, duplicate: true };
      const chunks = chunkPages(pages);
      if (chunks.length + this.rows.length > this.maxChunks)
        throw new Error(
          `Workspace limit is ${this.maxChunks.toLocaleString("en-US")} passages. Remove documents before adding more.`,
        );
      const vectors = await this.embed(chunks.map((c) => c.text));
      if (vectors.length !== chunks.length)
        throw new Error("Embedding count mismatch.");
      const rows = chunks.map((c, i) => ({
        id: `${id}:${i}`,
        documentId: id,
        name: String(name || "Untitled").slice(0, 200),
        text: c.text,
        page: c.page,
        position: i,
        vector: vectors[i],
        concepts: JSON.stringify(concepts(c.text)),
        addedAt: new Date().toISOString(),
      }));
      if (this.table) await this.table.add(rows);
      else this.table = await this.db.createTable("passages", rows);
      this.rows.push(...rows);
      this.rebuildGraph();
      return { id, name, chunks: rows.length, duplicate: false };
    });
  }

  async remove(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid document ID.");
    return this.mutate(async () => {
      if (!this.rows.some((r) => r.documentId === id)) return false;
      await this.table.delete(`\`documentId\` = '${id}'`);
      this.rows = this.rows.filter((r) => r.documentId !== id);
      this.rebuildGraph();
      return true;
    });
  }

  documents() {
    const docs = new Map();
    for (const row of this.rows) {
      const doc = docs.get(row.documentId) || {
        id: row.documentId,
        name: row.name,
        chunks: 0,
        pages: 0,
        addedAt: row.addedAt,
      };
      doc.chunks++;
      doc.pages = Math.max(doc.pages, row.page);
      docs.set(doc.id, doc);
    }
    return [...docs.values()];
  }

  rebuildGraph() {
    this.graph.clear();
    for (const row of this.rows) {
      this.graph.mergeNode(row.documentId, {
        label: row.name,
        type: "document",
      });
      this.graph.addNode(row.id, {
        label: `Passage ${row.position + 1}`,
        type: "passage",
        documentId: row.documentId,
      });
      this.graph.addEdge(row.documentId, row.id, { relation: "contains" });
      for (const term of JSON.parse(row.concepts)) {
        const key = `concept:${term}`;
        this.graph.mergeNode(key, { label: term, type: "concept" });
        this.graph.addEdge(row.id, key, { relation: "mentions" });
      }
    }
  }

  graphView() {
    // Aggregate passage mentions into document/concept edges for a readable view.
    const nodes = this.documents().map((d) => ({
      id: d.id,
      label: d.name,
      type: "document",
    }));
    const edges = [];
    const terms = this.graph
      .filterNodes((id, attrs) => attrs.type === "concept")
      .sort((a, b) => this.graph.degree(b) - this.graph.degree(a))
      .slice(0, 65);
    for (const term of terms) {
      nodes.push({ id: term, ...this.graph.getNodeAttributes(term) });
      const docs = new Set(
        this.graph
          .neighbors(term)
          .map((id) => this.graph.getNodeAttribute(id, "documentId")),
      );
      for (const doc of docs)
        edges.push({ source: doc, target: term, relation: "mentions" });
    }
    return {
      nodes,
      edges,
      totalNodes: this.graph.order,
      totalEdges: this.graph.size,
    };
  }

  retrieve(question, options = {}) {
    return this.mutate(() => this.search(question, options));
  }

  async search(question, { documentIds = [], mode = "hybrid", topK = 8 } = {}) {
    if (!["vector", "hybrid"].includes(mode))
      throw new Error("Unknown retrieval mode.");
    if (
      !Array.isArray(documentIds) ||
      !documentIds.every((id) => /^[a-f0-9]{64}$/.test(id))
    )
      throw new Error("Invalid document selection.");
    if (!this.table || !this.rows.length) return [];
    const allowed = new Set(
      documentIds.length ? documentIds : this.documents().map((d) => d.id),
    );
    if ([...allowed].some((id) => !this.rows.some((r) => r.documentId === id)))
      throw new Error(
        "A selected document no longer exists. Refresh the library.",
      );
    const [vector] = await this.embed([question]);
    const filter = `\`documentId\` IN (${[...allowed].map((id) => `'${id}'`).join(",")})`;
    const direct = await this.table
      .vectorSearch(vector)
      .distanceType("cosine")
      .where(filter)
      .limit(topK)
      .toArray();
    const ranked = new Map(
      direct
        .filter((r) => r._distance < 0.85)
        .map((r) => [r.id, { ...r, score: 1 - r._distance, via: "vector" }]),
    );
    if (mode === "hybrid") {
      for (const seed of [...ranked.values()].slice(0, 4)) {
        for (const term of this.graph
          .neighbors(seed.id)
          .filter((id) => id.startsWith("concept:"))) {
          const neighbors = this.graph.neighbors(term);
          if (neighbors.length > 40) continue;
          for (const id of neighbors) {
            const row = this.rows.find((r) => r.id === id);
            if (!row || !allowed.has(row.documentId)) continue;
            const existing = ranked.get(id);
            if (existing) existing.score += 0.015;
            else
              ranked.set(id, {
                ...row,
                score: seed.score * 0.7,
                via: `graph: ${this.graph.getNodeAttribute(term, "label")}`,
              });
          }
        }
      }
    }
    return [...ranked.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((row, i) => ({
        citation: i + 1,
        id: row.id,
        documentId: row.documentId,
        name: row.name,
        page: row.page,
        position: row.position,
        text: row.text,
        score: Number(row.score.toFixed(3)),
        via: row.via,
      }));
  }
}
