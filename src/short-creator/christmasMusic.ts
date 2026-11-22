import fs from "fs-extra";
import path from "path";
import type { Config } from "../config";
import type { ChristmasCard } from "./christmas";

/**
 * Carefully selected instrumental RECORDINGS with commercial-use licenses.
 * NO Polar Express soundtrack or copyrighted commercial film recording.
 * CC BY works require credit on YouTube, Facebook and Instagram descriptions.
 * Download from Wikimedia Commons on first use and cache locally.
 */
export const CHRISTMAS_TRACKS = [
  {
    key: "deck-the-halls",
    title: "Deck the Halls",
    artist: "United States Air Force Band",
    filename: "Deck the Halls (USAFB Concert Band) - abridged.ogg",
    extension: "ogg",
    license: "Public domain (US federal government work)",
    credit: "Music: Deck the Halls — United States Air Force Band (public domain).",
    source: "https://commons.wikimedia.org/wiki/File:Deck_the_Halls_(USAFB_Concert_Band)_-_abridged.ogg",
  },
  {
    key: "jingle-bells",
    title: "Jingle Bells",
    artist: "Kevin MacLeod",
    filename: "Jingle Bells (ISRC USUAN1100187).mp3",
    extension: "mp3",
    license: "CC BY 3.0",
    credit: "Music: Jingle Bells — Kevin MacLeod (incompetech.com), CC BY 3.0: https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Jingle_Bells_(ISRC_USUAN1100187).mp3",
  },
  {
    key: "silent-night",
    title: "Silent Night",
    artist: "Kevin MacLeod",
    filename: "Silent Night (ISRC USUAN1100075).mp3",
    extension: "mp3",
    license: "CC BY 3.0",
    credit: "Music: Silent Night — Kevin MacLeod (incompetech.com), CC BY 3.0: https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Silent_Night_(ISRC_USUAN1100075).mp3",
  },
] as const;

/** Rotate melodies; keep Silent Night for reverent Birth of Christ / Christmas Day. */
export function selectChristmasTrack(card: ChristmasCard) {
  if (card.mode === "christmas_day" || card.emphasis === "Birth of Christ") return CHRISTMAS_TRACKS[2];
  if (card.mode === "finale") return CHRISTMAS_TRACKS[0];
  return card.colorway === "green" ? CHRISTMAS_TRACKS[1] : CHRISTMAS_TRACKS[0];
}

export async function ensureChristmasMusic(config: Config, card: ChristmasCard) {
  const track = selectChristmasTrack(card);
  const localName = "christmas-" + track.key + "." + track.extension;
  const destination = path.join(config.tempDirPath, localName);
  if (!(await fs.pathExists(destination)) || (await fs.stat(destination)).size < 50000) {
    // This Wikimedia URL redirects to the specific source recording, not a search
    // result or current commercial recording. The allow-list is entirely static.
    const url = "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(track.filename);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "follow" });
    if (!response.ok) throw new Error("Christmas music unavailable: " + track.key + " (HTTP " + response.status + ")");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 15000000) throw new Error("Christmas music too large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 50000 || bytes.length > 15000000) throw new Error("Invalid Christmas music file size");
    const isOgg = track.extension === "ogg" && bytes.subarray(0, 4).toString("ascii") === "OggS";
    const isMp3 = track.extension === "mp3" && (bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
    if (!isOgg && !isMp3) throw new Error("Music source is not an audio file: " + track.key);
    const tempName = destination + ".download";
    await fs.writeFile(tempName, bytes);
    await fs.move(tempName, destination, { overwrite: true });
  }
  return {
    track,
    music: {
      file: localName,
      url: "http://localhost:" + config.port + "/api/tmp/" + encodeURIComponent(localName),
      start: 0,
      end: 15,
    },
  };
}
