import { createHash } from "node:crypto";

/**
 * Bible Brain Teaser content contract.
 * Stateless helpers: history persistence is the n8n/Google Sheets caller's responsibility.
 * IMPORTANT: Scripture references and answers must be verified before approved=true.
 */
export const FORMATS = ["trick", "who-am-i", "true-or-false", "numbers", "spot-the-mistake", "visual-clues", "this-or-that"];

export function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}


// TTS receives spoken words only. Keep emojis, decorations, hashtags and formatting in on-screen text.
export function toSpokenText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u20E3]/gu, " ")
    .replace(/[*_~\u0060|^#@%+=<>[\]{}\\/]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s.,!?;:'()\-–]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(value) {
  return createHash("sha256").update(normalize(value)).digest("hex");
}

function tokenize(text) {
  return new Set(normalize(text).split(" ").filter((word) => word.length > 2));
}

export function tokenSimilarity(left, right) {
  const a = tokenize(left); const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common++;
  return common / (a.size + b.size - common);
}

/**
 * Both canonicalConcept and answerFactId are editorially assigned stable IDs.
 * Example:
 * canonicalConcept = "ark-moses-noah-confusion"
 * answerFactId = "noah-not-moses-ark"
 *
 * This catches reworded versions without preventing unrelated Noah questions.
 */
export function duplicateReason(candidate, history = []) {
  const id = normalize(candidate.canonicalConcept);
  const fact = normalize(candidate.answerFactId);
  const question = fingerprint(candidate.question);
  for (const previous of history) {
    if (previous.status === "rejected") continue;
    if (question === fingerprint(previous.question)) return "same-question";
    if (id && id === normalize(previous.canonicalConcept)) return "same-concept";
    if (fact && fact === normalize(previous.answerFactId)) return "same-answer-fact";
    const sim = tokenSimilarity(candidate.question, previous.question);
    if (sim >= 0.72) return "high-question-similarity";
  }
  return null;
}

export function validatePuzzle(puzzle, history = []) {
  const errors = [];
  if (!FORMATS.includes(puzzle.format)) errors.push("unsupported-format");
  for (const key of ["question", "answer", "canonicalConcept", "answerFactId", "scriptureReference"]) {
    if (!String(puzzle[key] ?? "").trim()) errors.push("missing-" + key);
  }
  if (puzzle.scriptureVerified !== true) errors.push("scripture-not-verified");
  if (puzzle.approved !== true) errors.push("not-approved");
  if (String(puzzle.question ?? "").length > 230) errors.push("question-too-long");
  const repeat = duplicateReason(puzzle, history);
  if (repeat) errors.push("duplicate:" + repeat);
  return { ok: errors.length === 0, errors };
}

export function buildDescription(puzzle) {
  // The answer is below a separator; platforms do NOT guarantee it will be hidden.
  const options = (puzzle.options ?? []).map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n");
  return [
    "🧠 BIBLE BRAIN TEASER!",
    "",
    puzzle.question,
    options,
    "",
    "💬 Comment your guess BEFORE reading below!",
    "👇 Tap more to check your answer.",
    "",
    "✨ ✨ ✨",
    "📖 📖 📖",
    "⬇️ ⬇️ ⬇️",
    "",
    `✅ ANSWER: ${puzzle.answer}`,
    `📖 ${puzzle.scriptureReference}`,
    puzzle.explanation ?? "",
    "",
    "#BibleQuiz #BibleTrivia #GraceInAMinute"
  ].filter((line) => line !== null).join("\n");
}

export function buildRenderPlan(puzzle) {
  const validation = validatePuzzle(puzzle);
  if (!validation.ok) throw new Error("Puzzle requires approval: " + validation.errors.join(", "));
  const options = (puzzle.options ?? []).map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`);
  return {
    id: puzzle.id,
    contentType: "bible-brain-teaser",
    durationSeconds: 18,
    aspectRatio: "9:16",
    status: "preview-only",
    artworkPrompt: puzzle.backgroundPrompt || "Cheerful respectful family-friendly Bible scene, bright colorful 3D illustration, no text, space for quiz overlay",
    musicMood: "playful light Christian family quiz, not dramatic",
    narration: {
      engine: "kokoro",
      voiceId: "am_michael",
      language: "en-US",
      speed: 1.0,
      style: "warm, upbeat, conversational quiz host",
      pauseMs: { afterQuestion: 350, betweenOptions: 220, beforeCta: 280 },
      musicDucking: true,
      placeholderTtsAllowed: false,
      fitVideoToSpeech: true
    },
    scenes: [
      { start: 0, end: 3, title: "BIBLE BRAIN TEASER!", narration: "Think you know your Bible?" },
      { start: 3, end: 8, title: "TRICK QUESTION!", text: puzzle.question, narration: toSpokenText(puzzle.question) },
      { start: 8, end: 13, title: "CHOOSE YOUR ANSWER", text: options.join("\n"), narration: options.map((option, i) => `Option ${String.fromCharCode(65 + i)}. ${toSpokenText(option)}.`).join(" ") },
      { start: 13, end: 18, title: "YOUR TURN!", text: "Comment your answer!\nThen check the description.", narration: "Comment your answer. Then check the description!" }
    ],
    description: buildDescription(puzzle),
    answerShownInVideo: false,
    autoPublish: false
  };
}

export const EXAMPLE = {
  id: "BP-0001",
  format: "trick",
  question: "How many animals did Moses take on the ark?",
  options: ["Lions", "Elephants", "None!"],
  answer: "C. None! It was Noah, not Moses.",
  explanation: "Noah built the ark and brought the animals aboard.",
  canonicalConcept: "ark-moses-noah-confusion",
  answerFactId: "noah-not-moses-ark",
  scriptureReference: "Genesis 6–7",
  scriptureVerified: true,
  approved: true,
  backgroundPrompt: "Cheerful Noah's ark with animals peeking out, bright water, cloud-filled sky, respectful colorful storybook animation"
};
