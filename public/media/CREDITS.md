# Media credits

## Photos (public/media/img/ph-01 ... ph-41.jpg)
Downloaded via https://picsum.photos (seeded endpoints `/seed/kinetic01..41/W/H`), which serves photographs from
Unsplash contributors under the Unsplash License (free to use, no attribution required; see https://unsplash.com/license
and https://picsum.photos). Recompressed to JPEG with ffmpeg (<170 KB each). Per-photo photographer credit is not exposed
by the seeded endpoint; replace with attributed assets before a commercial launch if required.

## Videos (public/media/vid/*.mp4) and posters (public/media/poster/*.jpg)
All 13 videos (aurora-neon, ember-flow, ocean-silk, violet-nebula, lime-pulse, sunset-haze, ice-glass, rose-gold,
v-neon, v-ember, v-ocean, v-violet, hero) are PROCEDURALLY GENERATED in this project with ffmpeg lavfi
(`geq` periodic plasma fields mapped through two-colour palettes, bicubic upscale, gblur, eq, vignette, temporal noise;
H.264, faststart, 4 s seamless loops, no audio). They contain no third-party material and are released as part of
this project. Posters are single frames extracted from the same videos.

## Blur placeholders
Tiny 10 px JPEG base64 strings in src/lib/media-library.ts derived from the assets above.

## Motion loops (public/media/motion/ph-01 ... ph-41.mp4)
One 3.5 s, 24 fps seamless loop per photo (540x540, 640x360, 360x640 or 640x480 by aspect; H.264 main, yuv420p, faststart,
no audio, each <= 120 KB, ~4 MB total). They are DERIVED WORKS of the photos above (same Unsplash License terms), produced
by `scripts/media/make-motion.sh` with ffmpeg: periodic Ken-Burns zoompan (zoom starts at 1.0 so frame 0 equals the poster
photo), a per-image pan direction, light colour grade, vignette and a slow brightness "breathing" pulse. Re-run the script to
regenerate (`scripts/media/make-motion.sh [ph-01 ...]`). The poster for every loop is the original photo in public/media/img.
No WebM variants are shipped (H.264 is universally playable and the budget is already small).
