#!/usr/bin/env bash
# render-build.sh — Render.com build script
# Downloads the yt-dlp standalone binary so /api/stream works.

set -e

echo "==> Downloading yt-dlp binary..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp
echo "==> yt-dlp installed at $(pwd)/yt-dlp"
./yt-dlp --version
