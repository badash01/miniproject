import { test } from "node:test";
import assert from "node:assert/strict";
import {
  namedDocuments,
  questionIntent,
  verifiedQuestionCount,
  completeModelAnswer,
} from "../lib/evidence.js";

test("filename matching respects word boundaries and count intent accepts the reported typo", () => {
  const documents = [
    { id: "a", name: "assignmentcg.pdf" },
    { id: "b", name: "module.pdf" },
  ];
  assert.deepEqual(namedDocuments("Summary of AssignmentCG.pdf", documents), [
    documents[0],
  ]);
  assert.deepEqual(namedDocuments("summary of preassignmentcg", documents), []);
  assert.equal(
    questionIntent("how may questions in assignmentcg"),
    "question_count",
  );
  assert.equal(questionIntent("summary of assignmentcg"), "overview");
  assert.equal(
    questionIntent("how many questions involve rotation?"),
    "overview",
  );
  assert.equal(
    questionIntent("how many multiple choice questions?"),
    "overview",
  );
  assert.equal(questionIntent("What is rasterization?"), "search");
});

test("question counts deduplicate overlapping labels and refuse partial or ambiguous totals", () => {
  const context = {
    intent: "question_count",
    documents: [{ id: "a", name: "assignmentcg.pdf" }],
    coverage: { complete: true },
    sources: [
      {
        documentId: "a",
        citation: 1,
        text: "Q1. First prompt. Q2. Second prompt.",
      },
      {
        documentId: "a",
        citation: 2,
        text: "Q2. Second prompt. Q3. Final prompt.",
      },
    ],
  };
  assert.match(
    verifiedQuestionCount(context).answer,
    /3 distinct numbered questions/,
  );
  assert.equal(verifiedQuestionCount(context).verified, true);
  assert.equal(
    verifiedQuestionCount({ ...context, coverage: { complete: false } })
      .verified,
    undefined,
  );
  assert.equal(
    verifiedQuestionCount({
      ...context,
      sources: [
        { documentId: "a", citation: 1, text: "Q1. First. Q3. Third." },
      ],
    }).verified,
    undefined,
  );
  assert.equal(
    verifiedQuestionCount({
      ...context,
      sources: [
        { documentId: "a", citation: 1, text: "No explicit question labels." },
      ],
    }).verified,
    undefined,
  );
});

test("incomplete model output is rejected for compatible and Gemini providers", () => {
  assert.throws(
    () =>
      completeModelAnswer({
        choices: [
          {
            finish_reason: "length",
            message: { content: "A partial claim [1]" },
          },
        ],
      }),
    /incomplete answer/,
  );
  assert.throws(
    () =>
      completeModelAnswer(
        {
          candidates: [
            {
              finishReason: "MAX_TOKENS",
              content: { parts: [{ text: "Partial [1]" }] },
            },
          ],
        },
        { gemini: true },
      ),
    /incomplete answer/,
  );
  assert.equal(
    completeModelAnswer({
      choices: [
        { finish_reason: "stop", message: { content: "Complete. [1]" } },
      ],
    }),
    "Complete. [1]",
  );
  assert.throws(() => completeModelAnswer({ choices: [] }), /empty answer/);
});
