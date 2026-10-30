import formidable from "formidable";
import { readFile, unlink } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractFile(file) {
  const buffer = await readFile(file.filepath);
  const extension = extname(file.originalFilename || "").toLowerCase();
  if (extension === ".pdf") {
    const loading = getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 500) throw new Error("PDF exceeds 500 pages.");
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pages.push(content.items.map((item) => item.str || "").join(" "));
      }
      return pages;
    } finally {
      await loading.destroy();
    }
  }
  if (extension === ".docx")
    return [(await mammoth.extractRawText({ buffer })).value];
  if ([".txt", ".md"].includes(extension)) return [buffer.toString("utf8")];
  throw new Error("Supported formats: PDF, DOCX, TXT, MD.");
}

export function ragApi({ store, json, readBody, generate, configured }) {
  return async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (
      !path.startsWith("/api/documents") &&
      !["/api/graph", "/api/ask"].includes(path)
    )
      return false;
    try {
      if (path === "/api/documents" && request.method === "GET") {
        json(response, 200, {
          documents: store.documents(),
          chunks: store.rows.length,
        });
      } else if (path === "/api/documents" && request.method === "POST") {
        const results = [];
        if (request.headers["content-type"]?.includes("multipart/form-data")) {
          const temporary = [];
          const form = formidable({
            maxFiles: 20,
            maxFileSize: 20 * 1024 * 1024,
            maxTotalFileSize: 50 * 1024 * 1024,
            maxFields: 5,
            maxFieldsSize: 1500000,
            allowEmptyFiles: false,
          });
          form.on("fileBegin", (_name, file) => temporary.push(file));
          try {
            const [, files] = await form.parse(request);
            for (const file of Object.values(files).flat()) {
              try {
                results.push(
                  await store.add({
                    name: file.originalFilename,
                    pages: await extractFile(file),
                  }),
                );
              } catch (error) {
                results.push({
                  name: file.originalFilename,
                  error: error.message,
                });
              }
            }
          } finally {
            await Promise.all(
              temporary.map((file) => unlink(file.filepath).catch(() => {})),
            );
          }
          if (!results.length) throw new Error("Choose at least one document.");
        } else {
          const body = JSON.parse(await readBody(request));
          if (typeof body.text !== "string")
            throw new Error("Document text is required.");
          results.push(
            await store.add({ name: body.name, pages: [body.text] }),
          );
        }
        json(response, results.every((r) => r.error) ? 400 : 200, { results });
      } else if (
        /^\/api\/documents\/[a-f0-9]{64}$/.test(path) &&
        request.method === "DELETE"
      ) {
        const removed = await store.remove(path.split("/").pop());
        json(response, removed ? 200 : 404, { removed });
      } else if (path === "/api/graph" && request.method === "GET") {
        json(response, 200, store.graphView());
      } else if (path === "/api/ask" && request.method === "POST") {
        const body = JSON.parse(await readBody(request));
        if (
          typeof body.question !== "string" ||
          !body.question.trim() ||
          body.question.length > 2000
        )
          throw new Error("Enter a question of 1 to 2,000 characters.");
        const sources = await store.retrieve(body.question, {
          documentIds: body.documentIds,
          mode: body.mode,
        });
        if (!sources.length) {
          json(response, 200, {
            answer:
              "No matching passages were found in the selected documents.",
            sources: [],
            generated: false,
          });
        } else if (!configured()) {
          json(response, 200, {
            answer: sources
              .map((s) => `${s.text} [${s.citation}]`)
              .join("\n\n"),
            sources,
            generated: false,
            notice:
              "Retrieved passages only. Configure LLM_API_KEY for a generated answer.",
          });
        } else {
          const answer = await generate(body.question, sources);
          const citations = [...answer.matchAll(/\[(\d+)\]/g)].map((m) =>
            Number(m[1]),
          );
          if (
            !citations.length ||
            citations.some((c) => c < 1 || c > sources.length)
          ) {
            json(response, 200, {
              answer: sources
                .map((s) => `${s.text} [${s.citation}]`)
                .join("\n\n"),
              sources,
              generated: false,
              notice:
                "The model returned an answer without valid citations. Showing retrieved evidence.",
            });
          } else json(response, 200, { answer, sources, generated: true });
        }
      } else json(response, 405, { message: "Route or method not supported." });
    } catch (error) {
      json(response, path === "/api/ask" ? 502 : 400, {
        message: error.message || "RAG request failed.",
      });
    }
    return true;
  };
}
