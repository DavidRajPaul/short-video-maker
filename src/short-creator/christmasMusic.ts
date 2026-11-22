import fs from "fs-extra";
import path from "path";
import type { Config } from "../config";
import type { ChristmasCard } from "./christmas";

/**
 * Commercial-use instrumental recordings from the COMPOSER'S official site.
 * Kevin MacLeod permits Creative Commons Attribution 4.0 use with credit.
 * This is NOT a license for the Polar Express soundtrack.
 *
 * https://incompetech.com/music/royalty-free/index.html
 * https://creativecommons.org/licenses/by/4.0/
 */
export const CHRISTMAS_TRACKS = [
  {
    key: "deck-the-halls",
    title: "Deck the Halls B",
    artist: "Kevin MacLeod",
    filename: "Deck the Halls B.mp3",
    extension: "mp3",
    license: "CC BY 4.0",
    credit: '"Deck the Halls B" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/',
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100368",
  },
  {
    key: "jingle-bells",
    title: "Jingle Bells",
    artist: "Kevin MacLeod",
    filename: "Jingle Bells.mp3",
    extension: "mp3",
    license: "CC BY 4.0",
    credit: '"Jingle Bells" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/',
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100187",
  },
  {
    key: "silent-night",
    title: "Silent Night",
    artist: "Kevin MacLeod",
    filename: "Silent Night.mp3",
    extension: "mp3",
    license: "CC BY 4.0",
    credit: '"Silent Night" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/',
    source: "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100075",
  },
] as const;

export function selectChristmasTrack(card: ChristmasCard) {
  if (card.mode === "christmas_day" || card.emphasis === "Birth of Christ") return CHRISTMAS_TRACKS[2];
  if (card.mode === "finale") return CHRISTMAS_TRACKS[0];
  return card.colorway === "green" ? CHRISTMAS_TRACKS[1] : CHRISTMAS_TRACKS[0];
}

export async function ensureChristmasMusic(config: Config, card: ChristmasCard) {
  const track = selectChristmasTrack(card);
  const localName = "christmas-" + track.key + ".mp3";
  const destination = path.join(config.tempDirPath, localName);
  if (!(await fs.pathExists(destination)) || (await fs.stat(destination)).size < 50000) {
    // All file names are from the curated source-controlled allow-list above.
    const url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + encodeURIComponent(track.filename);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "GraceInAMinuteChristmasRenderer/1.0" },
      });
      if (response.ok) break;
      if (![429, 502, 503, 504].includes(response.status) || attempt === 3) {
        throw new Error("Christmas music unavailable: " + track.key + " (HTTP " + response.status + ")");
      }
      await new Promise((resolve) => setTimeout(resolve, 1200 * 2 ** attempt));
    }
    if (!response?.ok) throw new Error("Christmas music unavailable: " + track.key);
    const sizeHint = Number(response.headers.get("content-length") || 0);
    if (sizeHint > 20000000) throw new Error("Music exceeds size limit");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 50000 || bytes.length > 20000000) throw new Error("Invalid Christmas music file size");
    const validMp3 = bytes.subarray(0, 3).toString("ascii") === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    if (!validMp3) throw new Error("Source did not provide MP3 audio: " + track.key);
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
