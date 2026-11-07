// n8n Code node: Run Once for All Items.
// Input contract: each item.json has format, searchTerms or sceneSearchTerms,
// and prayerText (morning/intense) OR verseText + explanationText + prayerText
// (evening). Do not pass arbitrary stage directions to the TTS text field.
// This node creates an unpublished rendering payload; it does NOT publish.
const ALLOWED_FORMATS = new Set(["morning_prayer", "evening_verse", "intense_prayer"]);
const DEFAULT_PROFILE = { mood: "uplifting", intensity: 75 };
const DEFAULT_SPEED = 0.9;
const MAX_TEXT = 5000;

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_TEXT) {
    throw new Error(label + " must be a nonempty string (max " + MAX_TEXT + " chars)");
  }
  const text = value.trim();
  if (/<\/?(?:speak|break|prosody|voice|emphasis)\b/i.test(text) ||
      /\[(?:whisper|sigh|excited|gasp|sad|laugh|cry|powerful|uplifting|warm|gentle|reverent)[^\]]*\]/i.test(text)) {
    throw new Error(label + " contains audio directions; use delivery metadata");
  }
  return text;
}
function keywords(value, label) {
  if (!Array.isArray(value) || !value.length || value.some(v => typeof v !== "string" || !v.trim())) {
    throw new Error(label + " must be a nonempty array of search keywords");
  }
  return value;
}
function termsFor(data, key) {
  return keywords(data.sceneSearchTerms?.[key] ?? data.searchTerms, "searchTerms for " + key);
}
function scene(text, terms, delivery, pauseAfterMs) {
  return { text, searchTerms: terms, narration: { segments: [{ text, delivery, pauseAfterMs }] } };
}

return $input.all().map(({json}) => {
  if (!ALLOWED_FORMATS.has(json.format)) throw new Error("Unsupported devotional format");
  const config = {
    ...(json.renderConfig || {}),
    narrationProfile: DEFAULT_PROFILE,
    speechSpeed: DEFAULT_SPEED,
    voice: json.renderConfig?.voice ?? "af_heart",
  };
  // No content from external input can override the canonical profile after assignment.
  const format = json.format;
  let scenes;
  if (format === "evening_verse") {
    // Use the exact source text. The upstream sheet/translation remains the authority;
    // the adapter does not generate, summarize, or translate the Scripture.
    const verse = requiredText(json.verseText, "verseText");
    const explanation = requiredText(json.explanationText, "explanationText");
    const prayer = requiredText(json.prayerText, "prayerText");
    const reference = requiredText(json.verseReference, "verseReference");
    scenes = [
      scene(verse, termsFor(json, "scripture"), "reverent", 900),
      scene(explanation, termsFor(json, "explanation"), "uplifting", 500),
      scene(prayer, termsFor(json, "prayer"), "warm", 800),
    ];
    config.coverSubtitle = reference;
    config.strictChristianVisuals = true;
  } else {
    const prayer = requiredText(json.prayerText, "prayerText");
    const segments = json.prayerSegments;
    if (segments !== undefined && (!Array.isArray(segments) || !segments.length)) {
      throw new Error("prayerSegments must be a nonempty array when supplied");
    }
    if (segments) {
      const prepared = segments.map((s,i) => ({
        text: requiredText(s.text, "prayerSegments[" + i + "].text"),
        delivery: format === "intense_prayer" ? "powerful" : "uplifting",
        pauseAfterMs: i === segments.length - 1 ? 800 : 450,
      }));
      if (prepared.map(s => s.text).join(" ") !== prayer) {
        throw new Error("prayerSegments must match prayerText exactly");
      }
      scenes = [{
        text: prayer,
        searchTerms: termsFor(json, "prayer"),
        narration: { segments: prepared },
      }];
    } else {
      scenes = [scene(prayer, termsFor(json, "prayer"),
        format === "intense_prayer" ? "powerful" : "uplifting", 800)];
    }
  }
  return {
    json: {
      ...json,
      // Explicitly distinct from source input so the existing publishing branches
      // can be left disabled until review of an unpublished preview.
      renderPayload: { scenes, config },
      narrationValidation: {
        format,
        scriptureFirst: format === "evening_verse",
        expectedSpokenVerse: format === "evening_verse" ? json.verseText.trim() : null,
        manualPreviewRequired: true,
        readyToPublish: false,
      },
    },
  };
});
