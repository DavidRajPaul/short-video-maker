import type { Caption } from "../../types/shorts";

/** Normalized PCM is produced by FFmpeg at 16 kHz, mono, signed 16-bit. */
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;

function pcmData(wav: ArrayBuffer): Buffer {
  const input = Buffer.from(wav);
  if (input.toString("ascii", 0, 4) !== "RIFF" || input.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a RIFF/WAVE audio segment");
  }
  let offset = 12;
  let foundFormat = false;
  while (offset + 8 <= input.length) {
    const type = input.toString("ascii", offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > input.length) throw new Error("Truncated WAV chunk");
    if (type === "fmt ") {
      if (size < 16 || input.readUInt16LE(start) !== 1 ||
          input.readUInt16LE(start + 2) !== CHANNELS ||
          input.readUInt32LE(start + 4) !== SAMPLE_RATE ||
          input.readUInt16LE(start + 14) !== 16) {
        throw new Error("Expected 16kHz mono 16-bit PCM WAV");
      }
      foundFormat = true;
    }
    if (type === "data") {
      if (!foundFormat || size === 0 || size % BYTES_PER_SAMPLE !== 0) {
        throw new Error("Invalid WAV audio data");
      }
      return input.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  throw new Error("WAV audio data not found");
}

export type NarratedAudioSegment = {
  wav: ArrayBuffer;
  captions: Caption[];
  pauseAfterMs: number;
};

export function composeNarrationAudio(segments: NarratedAudioSegment[]): {
  audio: ArrayBuffer;
  audioLength: number;
  captions: Caption[];
} {
  if (!segments.length) throw new Error("Narration requires at least one segment");
  const pieces: Buffer[] = [];
  const captions: Caption[] = [];
  let elapsedSamples = 0;

  for (const segment of segments) {
    const pcm = pcmData(segment.wav);
    const startMs = elapsedSamples * 1000 / SAMPLE_RATE;
    const segmentMs = pcm.length / BYTES_PER_SAMPLE * 1000 / SAMPLE_RATE;
    for (const caption of segment.captions) {
      // Each Whisper transcript is relative to its *own* speech segment.
      if (caption.startMs < 0 || caption.endMs < caption.startMs) {
        throw new Error("Invalid caption timestamps");
      }
      if (caption.startMs > segmentMs + 250 || caption.endMs > segmentMs + 250) {
        throw new Error("Caption exceeds synthesized segment duration");
      }
      captions.push({
        text: caption.text,
        startMs: Math.round(startMs + caption.startMs),
        endMs: Math.round(startMs + Math.min(caption.endMs, segmentMs)),
      });
    }
    pieces.push(pcm);
    elapsedSamples += pcm.length / BYTES_PER_SAMPLE;

    if (!Number.isInteger(segment.pauseAfterMs) || segment.pauseAfterMs < 0 || segment.pauseAfterMs > 2000) {
      throw new Error("Pause must be between 0 and 2000 milliseconds");
    }
    const silentSamples = Math.round(segment.pauseAfterMs * SAMPLE_RATE / 1000);
    if (silentSamples) {
      pieces.push(Buffer.alloc(silentSamples * BYTES_PER_SAMPLE));
      elapsedSamples += silentSamples;
    }
  }

  const dataLength = elapsedSamples * BYTES_PER_SAMPLE;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
  header.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);
  const result = Buffer.concat([header, ...pieces], 44 + dataLength);
  return {
    audio: Uint8Array.from(result).buffer,
    audioLength: elapsedSamples / SAMPLE_RATE,
    captions,
  };
}
