import fs from "node:fs";
import path from "node:path";

/**
 * Loads every .md / .txt file from the data folder and wraps each one in
 * a <document> tag so Claude can tell the files apart and cite them.
 *
 * This is "RAG v0": the whole knowledge base goes into the prompt and is
 * cached. It works well up to roughly 100 pages. When a client has more
 * than that, step 2 is to add embeddings + vector search and send only
 * the relevant chunks.
 */
export function loadKnowledgeBase(dir = "data"): string {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
    .sort(); // deterministic order keeps the prompt cache valid

  if (files.length === 0) {
    throw new Error(`No .md or .txt files found in ${dir}/`);
  }

  return files
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), "utf8").trim();
      return `<document name="${file}">\n${text}\n</document>`;
    })
    .join("\n\n");
}
