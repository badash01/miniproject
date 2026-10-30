import { basename, extname } from "node:path";

function words(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namedDocuments(question, documents) {
  const query = ` ${words(question)} `;
  return documents.filter((document) => {
    const stem = words(basename(document.name, extname(document.name)));
    return stem.length >= 3 && query.includes(` ${stem} `);
  });
}

export function questionIntent(question) {
  const query = words(question);
  if (
    /\b(how (many|may)|number of|count|total)\b.*\bquestions?\b|\bquestions?\b.*\b(count|total)\b/.test(
      query,
    )
  ) {
    // A subset count needs content interpretation, not the total of question labels.
    const totalRequest =
      /\b(how (many|may)|number of|count|total)(?: of)?(?: the)? questions?\b|\bquestions? (count|total)\b/.test(
        query,
      );
    const subsetRequest =
      /\bquestions? (?:that |which |are |do )?(about|involv\w*|requir\w*|relat\w*|cover\w*|use\w*|ask\w*|with|have|contain\w*|deal\w*)\b/.test(
        query,
      );
    return totalRequest && !subsetRequest ? "question_count" : "overview";
  }
  if (
    /\b(summary|summari[sz]e|overview|outline)\b|\b(list|show|give)\b.*\ball\b.*\bquestions?\b/.test(
      query,
    )
  )
    return "overview";
  return "search";
}

export function verifiedQuestionCount(context) {
  if (context.intent !== "question_count") return null;
  if (!context.coverage.complete)
    return {
      answer:
        "I cannot give a reliable total because the available context does not cover the entire document. Narrow the document selection or split the document into smaller files.",
    };
  const answers = [];
  for (const document of context.documents) {
    const labels = new Set();
    const citations = [];
    for (const source of context.sources.filter(
      (s) => s.documentId === document.id,
    )) {
      let found = false;
      for (const match of source.text.matchAll(
        /\bQ(?:uestion)?\s*(\d{1,3})\s*[.):\-\u2013\u2014]/gi,
      )) {
        labels.add(Number(match[1]));
        found = true;
      }
      if (found) citations.push(`[${source.citation}]`);
    }
    const numbers = [...labels].sort((a, b) => a - b);
    if (!numbers.length || numbers.some((number, i) => number !== i + 1))
      return {
        answer:
          "I cannot reliably establish the total from the extracted question labels. Please inspect the source passages; I will not infer a total from an incomplete or ambiguous list.",
      };
    answers.push(
      `${document.name} contains ${numbers.length} distinct numbered questions (Q1${numbers.length > 1 ? ` through Q${numbers.at(-1)}` : ""}). ${citations.join(" ")}`,
    );
  }
  return { answer: answers.join("\n\n"), verified: true };
}

export function completeModelAnswer(payload, { gemini = false } = {}) {
  const finish = gemini
    ? payload.candidates?.[0]?.finishReason
    : payload.choices?.[0]?.finish_reason;
  if (finish === "length" || finish === "MAX_TOKENS")
    throw new Error(
      "The model reached its output limit and returned an incomplete answer. Please retry with a narrower question.",
    );
  const answer = gemini
    ? payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
    : payload.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim())
    throw new Error("The model returned an empty answer. Try again.");
  return answer;
}
