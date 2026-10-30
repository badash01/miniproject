import { fileURLToPath } from "node:url";
import { localEmbedder } from "../lib/rag.js";

const embed = localEmbedder(
  fileURLToPath(new URL("../.cache", import.meta.url)),
);
const [vector] = await embed(["Research Graph embedding runtime check."]);
if (vector.length !== 384 || !vector.every(Number.isFinite))
  throw new Error("Embedding model validation failed.");
console.log("MiniLM model cached and validated (384 dimensions).");
