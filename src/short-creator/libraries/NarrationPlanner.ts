import type { NarrationProfile, NarrationSegment, SceneInput, RenderConfig } from "../../types/shorts";

export type PlannedNarrationSegment = {
  text: string;
  delivery: NonNullable<NarrationSegment["delivery"]>;
  pauseAfterMs: number;
};
export type NarrationPlan = {
  provider: "kokoro";
  mood: NonNullable<NarrationProfile["mood"]>;
  intensity: number;
  speed: number;
  segments: PlannedNarrationSegment[];
};

// Only known *production directions* are removed. Other square-bracketed prose,
// including scripture references, is preserved rather than silently deleted.
const AUDIO_DIRECTIONS = /\[(?:whispers?|whispering|sighs?|sighing|excited|sad|laughs?|laughing|crying|angry|softly|reverent|uplifting|warm|gentle|powerful|reflective)\]/gi;
const SSML = /<\/?(?:speak|break|prosody|emphasis|say-as|voice)\b[^>]*>/gi;

export function cleanSpokenText(text: string): string {
  return text.normalize("NFKC")
    .replace(AUDIO_DIRECTIONS, " ")
    .replace(SSML, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#~]+/g, " ")
    .replace(/[<>|]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function splitIntoSentences(text: string): string[] {
  // Split only on sentence-final punctuation with a following space.
  // Do not split at numbers, verse references, or abbreviations lacking spacing.
  return text.split(/(?<=[.!?])\s+(?=[A-Z"“])/).filter(Boolean);
}

export function planNarration(scene: SceneInput, config: RenderConfig): NarrationPlan {
  const profile = config.narrationProfile;
  const mood = profile?.mood ?? "uplifting";
  const intensity = profile?.intensity ?? 75;
  const speed = config.speechSpeed ?? (profile ? 0.9 : 1);
  const explicit = scene.narration?.segments;
  let segments: PlannedNarrationSegment[];

  if (explicit) {
    segments = explicit.map(segment => ({
      text: cleanSpokenText(segment.text),
      delivery: segment.delivery ?? mood,
      pauseAfterMs: segment.pauseAfterMs ?? 0,
    }));
    // Fail closed on divergent spoken text; this also protects Bible verses
    // from silently being replaced by alternate narration.
    if (cleanSpokenText(scene.text) !== segments.map(s => s.text).join(" ")) {
      throw new Error("Structured narration must match scene.text exactly");
    }
  } else {
    const parts = profile ? splitIntoSentences(cleanSpokenText(scene.text)) : [cleanSpokenText(scene.text)];
    segments = parts.map((text, i) => ({
      text,
      delivery: mood,
      pauseAfterMs: profile && i < parts.length - 1 ? 350 : 0,
    }));
  }
  if (!segments.length || segments.some(s => !s.text)) throw new Error("Empty narration segment");
  return { provider: "kokoro", mood, intensity, speed, segments };
}
