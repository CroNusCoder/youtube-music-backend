'use strict';

const { execFile } = require('child_process');
const cache = require('./cache');
const { DEFAULT_CACHE_TTL } = require('../config/constants');

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

/**
 * Extract the best audio stream URL for a YouTube video using yt-dlp.
 * Results are cached in memory with a configurable TTL.
 *
 * @param {string} videoId — YouTube video ID (e.g. 'dQw4w9WgXcQ')
 * @returns {Promise<{ streamUrl: string, format: string, bitrate: string, expiresIn: number }>}
 */
async function getStreamUrl(videoId) {
  // 1. Check cache first
  const cached = cache.get(`stream:${videoId}`);
  if (cached) {
    return cached;
  }

  // 2. Build the video URL
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 3. Run yt-dlp to extract stream info
  //    We get both the URL and format info in one call using --print
  const result = await new Promise((resolve, reject) => {
    execFile(
      YT_DLP_PATH,
      [
        '-f', 'bestaudio',
        '--get-url',
        '--print', '%(format_id)s|||%(abr)s|||%(acodec)s|||%(ext)s',
        '--no-warnings',
        '--no-playlist',
        videoUrl,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          // Provide a more descriptive error
          const msg = stderr?.trim() || error.message;
          reject(new Error(`yt-dlp failed for ${videoId}: ${msg}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });

  // 4. Parse output — yt-dlp outputs the format info line first, then the URL
  const lines = result.split('\n').filter(Boolean);
  if (lines.length < 2) {
    throw new Error(`Unexpected yt-dlp output for ${videoId}: ${result}`);
  }

  const formatLine = lines[0]; // format_id|||abr|||acodec|||ext
  const streamUrl = lines[1];  // the actual stream URL

  const [formatId, abr, acodec, ext] = formatLine.split('|||');

  const streamData = {
    streamUrl,
    format: `${acodec || 'unknown'}/${ext || 'unknown'}`,
    bitrate: abr ? `${abr}k` : 'unknown',
    formatId: formatId || 'unknown',
    expiresIn: DEFAULT_CACHE_TTL,
  };

  // 5. Cache the result
  cache.set(`stream:${videoId}`, streamData, DEFAULT_CACHE_TTL);

  return streamData;
}

/**
 * Proxy an audio stream — pipes yt-dlp stdout directly to an HTTP response.
 * This lets the client stream audio through our server without exposing
 * the raw Google CDN URL.
 *
 * @param {string} videoId
 * @param {import('express').Response} res
 */
function proxyStream(videoId, res) {
  const { spawn } = require('child_process');
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const proc = spawn(YT_DLP_PATH, [
    '-f', 'bestaudio',
    '-o', '-',           // Output to stdout
    '--no-warnings',
    '--no-playlist',
    videoUrl,
  ]);

  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Transfer-Encoding', 'chunked');

  proc.stdout.pipe(res);

  proc.stderr.on('data', (chunk) => {
    console.error(`[yt-dlp proxy stderr] ${chunk.toString()}`);
  });

  proc.on('error', (err) => {
    console.error(`[yt-dlp proxy error] ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, data: null, error: 'Stream proxy failed' });
    }
  });

  proc.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      res.end();
    }
  });

  // If the client disconnects, kill the yt-dlp process
  res.on('close', () => {
    proc.kill('SIGTERM');
  });
}

module.exports = { getStreamUrl, proxyStream };
