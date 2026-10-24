# Product-tour video

`record.mjs` drives the **live site** with Playwright (chromium, 1280x720, DPR 1, `recordVideo`), overlays an animated
cursor, lower-third captions and a chapter chip (injected via `addInitScript`), then encodes with ffmpeg.
Guest flows only: no signup, no DB rows (it generates one image as a guest; that lives in the throwaway browser profile).

```bash
node scripts/tour/record.mjs                                  # records https://higgsfield-ai-clone-one.vercel.app
TOUR_URL=http://localhost:3000 node scripts/tour/record.mjs   # or any other deployment
```

Env: `TOUR_URL`, `TOUR_OUT` (default `public/media/tour`), `TOUR_CRF` (26), `TOUR_KEEP=1` (keep raw webm), `FFMPEG`.

Outputs in `public/media/tour/`: `kinetic-tour.mp4` (H.264 yuv420p, faststart, no audio), `kinetic-tour.jpg` (poster),
`kinetic-tour.vtt` (captions = the on-screen captions), `chapters.vtt` (the 8 scenes). The player reads `chapters.vtt`
at runtime, so re-recording needs no code change.

## When to re-record
After UI changes to the Home hero, search palette, Explore cards, Create studio (prompt, model select, Enhance,
Generate, result buttons), Library, Usage, theme toggle, accent picker or Connect page, or any `data-testid` the
script uses (`search-trigger`, `search-input`, `nav-*`, `feed-card`, `remix-btn`, `prompt-input`, `model-select`,
`enhance-btn`, `generate-btn`, `job-progress`, `result-card`, `share-btn`, `to-video-btn`, `library-item`,
`theme-toggle`, `theme-option-*`, `accent-switcher`, `accent-sv-area`, `accent-reset`, `mcp-copy-claude-code`).
To change wording or pacing edit the storyboard at the bottom of `record.mjs` (captions, `dwell(ms)` pauses).
Then review frames: `ffmpeg -ss 30 -i public/media/tour/kinetic-tour.mp4 -frames:v 1 f.jpg`.

## Notes
- Real timing: the script waits for the real `result-card`; generation is not faked. Record on a quiet machine:
  CPU load stretches every step (about 77s idle, 90s+ when loaded).
- Engage popups and the first-visit toast are suppressed via localStorage flags set by the init script.
- No music or voice-over: silent, captioned.
