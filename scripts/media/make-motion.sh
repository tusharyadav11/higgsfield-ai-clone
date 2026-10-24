#!/usr/bin/env bash
# Builds a short cinematic loop (Ken-Burns zoom + parallax-like pan + light grade/vignette/breathing light)
# for every photo in public/media/img -> public/media/motion/ph-NN.mp4 (no audio, h264 yuv420p, faststart).
# Loops are seamless: zoom and pan are periodic functions of the frame index.
# Usage: scripts/media/make-motion.sh [ph-01 ph-02 ...]   (default: all)
set -euo pipefail
cd "$(dirname "$0")/../.."
FFMPEG=${FFMPEG:-/opt/homebrew/bin/ffmpeg}
FFPROBE=${FFPROBE:-/opt/homebrew/bin/ffprobe}
OUT=public/media/motion
mkdir -p "$OUT"
FPS=24; SECS=3.5; N=84   # N = FPS * SECS frames

# variants: "ax ay phx phy zmin zmax grade"; zmin=1.00 so frame 0 == the poster photo (seamless poster->video fade)  (ax/ay in [-1,1] = pan amplitude as fraction of free room)
V=(
  "0.9 0.0 0.0 0.0 1.00 1.22 warm"
  "0.0 0.9 1.6 0.0 1.00 1.20 cool"
  "-0.9 0.5 3.1 1.0 1.00 1.24 teal"
  "0.7 -0.7 4.7 2.0 1.00 1.20 warm"
  "-0.6 0.0 0.0 0.0 1.00 1.26 neutral"
  "0.0 -0.9 0.8 3.0 1.00 1.22 cool"
  "0.8 0.8 2.4 0.5 1.00 1.21 teal"
  "-0.8 -0.6 5.5 1.5 1.00 1.23 warm"
)
grade() {
  case "$1" in
    warm)  echo "colorbalance=rs=.04:bs=-.04:rh=.03:bh=-.03,eq=saturation=1.12:contrast=1.05" ;;
    cool)  echo "colorbalance=rs=-.03:bs=.05:rh=-.02:bh=.04,eq=saturation=1.08:contrast=1.05" ;;
    teal)  echo "colorbalance=rs=-.04:gs=.02:bs=.03:rh=.04:bh=-.02,eq=saturation=1.15:contrast=1.06" ;;
    *)     echo "eq=saturation=1.1:contrast=1.06" ;;
  esac
}

if [ "$#" -gt 0 ]; then IDS=("$@"); else IDS=($(cd public/media/img && ls ph-*.jpg | sed 's/\.jpg//')); fi
for id in "${IDS[@]}"; do
  # variant derives from the photo number so sub-set runs reproduce the full run
  i=$((10#${id#ph-} - 1))
  src="public/media/img/$id.jpg"
  IFS=, read -r w h < <("$FFPROBE" -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "$src")
  # output size by aspect (matches ASPECT_SIZE in src/lib/models.ts); even dims
  if   [ "$w" -eq "$h" ]; then ow=540; oh=540
  elif [ $((w*9)) -eq $((h*16)) ]; then ow=640; oh=360
  elif [ "$h" -gt "$w" ]; then ow=360; oh=640
  else ow=640; oh=480; fi
  read -r ax ay phx phy zmin zmax g <<<"${V[$((i % ${#V[@]}))]}"
  zr=$(awk -v a="$zmin" -v b="$zmax" 'BEGIN{print b-a}')
  Z="$zmin+$zr*(1-cos(2*PI*on/$N))/2"
  X="(iw-iw/zoom)/2*(1+$ax*sin(2*PI*on/$N+$phx))"
  Y="(ih-ih/zoom)/2*(1+$ay*sin(2*PI*on/$N+$phy))"
  vf="scale=$((ow*2)):$((oh*2)):force_original_aspect_ratio=increase,crop=$((ow*2)):$((oh*2)),setsar=1,"
  vf+="zoompan=z='$Z':x='$X':y='$Y':d=1:s=${ow}x${oh}:fps=$FPS,"
  vf+="$(grade "$g"),"
  vf+="eq=brightness='0.025*sin(2*PI*n/$N+$phx)':eval=frame,"          # slow light "breathing" (light-leak feel)
  vf+="vignette=angle=PI/5:mode=backward:eval=init,scale=in_range=full:out_range=limited,format=yuv420p"
  for crf in 27 30 33 36 39; do
    "$FFMPEG" -v error -y -loop 1 -i "$src" -vf "$vf" -frames:v $N -r $FPS -an \
      -c:v libx264 -preset slow -crf $crf -profile:v main -maxrate 330k -bufsize 400k -g 48 \
      -movflags +faststart -pix_fmt yuv420p "$OUT/$id.mp4"
    sz=$(stat -f%z "$OUT/$id.mp4" 2>/dev/null || stat -c%s "$OUT/$id.mp4")
    [ "$sz" -le 120000 ] && break
  done
  echo "$id ${ow}x${oh} crf=$crf ${sz}B"
done
