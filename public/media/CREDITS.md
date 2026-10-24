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
