import test from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE, normalize, duplicateReason, validatePuzzle, buildDescription, buildRenderPlan } from "./brain-teaser.mjs";

test("normalization ignores casing and punctuation", () => {
  assert.equal(normalize("Moses' ARK?!"), "moses ark");
});

test("identical question rejected", () => {
  assert.equal(duplicateReason({ ...EXAMPLE, question: "HOW MANY ANIMALS DID MOSES TAKE ON THE ARK!!!", canonicalConcept: "other", answerFactId: "other" }, [{ ...EXAMPLE, status: "published" }]), "same-question");
});

test("paraphrase rejected by canonical concept", () => {
  const next = { ...EXAMPLE, question: "Did Moses bring lions onto the ark?" };
  assert.equal(duplicateReason(next, [{ ...EXAMPLE, status: "published" }]), "same-concept");
});

test("same answer fact rejected despite new wording and concept", () => {
  const next = { ...EXAMPLE, canonicalConcept: "another-name", question: "Which Bible person boarded the ark?", answerFactId: "noah-not-moses-ark" };
  assert.equal(duplicateReason(next, [EXAMPLE]), "same-answer-fact");
});

test("different facts in same story remain eligible", () => {
  const next = { ...EXAMPLE, question: "Which bird did Noah send out first?", canonicalConcept: "noah-first-bird", answerFactId: "noah-sent-raven", answer: "A raven", scriptureReference: "Genesis 8:7" };
  assert.equal(duplicateReason(next, [EXAMPLE]), null);
});

test("unverified and unapproved content cannot render", () => {
  const result = validatePuzzle({ ...EXAMPLE, approved: false, scriptureVerified: false });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("scripture-not-verified"));
  assert.ok(result.errors.includes("not-approved"));
});

test("answer kept out of the video but included in description", () => {
  const plan = buildRenderPlan(EXAMPLE);
  assert.equal(plan.answerShownInVideo, false);
  assert.equal(plan.autoPublish, false);
  assert.ok(!plan.scenes.some(s => JSON.stringify(s).includes("It was Noah")));
  assert.ok(buildDescription(EXAMPLE).includes("✅ ANSWER:"));
});
