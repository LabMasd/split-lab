# split.lab

Multi-video comparison tool. Load any number of videos — 2, 3, 4, no limit —
and compare them side by side in one frame, separated by draggable white mask
lines (grade / before-after wipe style). Export the composite with sound.

![split.lab](https://img.shields.io/badge/masd.lab-split.lab-F4501E)

## ▶ Use it in your browser

**https://labmasd.github.io/split-lab/** — no install. Everything runs
client-side (videos never leave your machine); export is H.264 MP4 + AAC,
encoded in the browser via WebCodecs. Chrome / Edge / Safari.

## Local version (adds ProRes)

The `public/` + `server.js` version exports through ffmpeg and adds
QuickTime ProRes 422 HQ / 4444 masters.

Requirements: Node.js (no npm dependencies) and
[ffmpeg](https://ffmpeg.org) on PATH (`brew install ffmpeg`).

```
node server.js
```

→ http://localhost:8165

## Features

- **Unlimited videos** — drop files anywhere on the page; each one shows
  full-frame (cover-fit), clipped to its own vertical slice
- **Draggable mask lines** — grab a line on the canvas and move the wipe;
  `⌖ center splits` snaps back to even spacing
- **Animated wipe** — line sweeps left→right or right→left, timed to the clip
  duration or a custom number of seconds; 3+ videos wipe sequentially
- **Audio** — per-clip 🔊 toggle (first clip on by default, so no double
  track); enabled tracks play in preview and are muxed into the export,
  mixed if more than one is on
- **Labels** — burn each clip's name into its region (rename in the sidebar)
- **Synced playback** — drift-corrected, loops at the shortest clip, scrub
  seeks all clips together, space to play/pause

## Export

Deterministic frame-by-frame render: every video is seeked to each exact frame
time, composited on canvas, and encoded by ffmpeg on the local server — no
screen capture, frame-accurate every time.

- **MP4** — H.264 crf 16 + AAC 320k
- **QuickTime** — ProRes 422 HQ or ProRes 4444 + 16-bit PCM
- 24 / 25 / 30 / 50 / 60 fps · source resolution or 1920 / 1280 wide
- Mask lines can be included or excluded from the render

## Notes

The browser UI is static, but export requires the Node server (frame upload +
ffmpeg encode), so it can't run on static hosting — clone and run locally.

---

a **masd.lab** tool · [masd.cc](https://masd.cc)
