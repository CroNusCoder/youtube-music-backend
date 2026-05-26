'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseNextResponse, parseLyricsResponse } = require('../parsers/responseParser');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

const router = Router();

/**
 * GET /api/lyrics/:videoId
 *
 * Fetches lyrics for a video. This is a two-step process:
 * 1. Call /next to get the lyricsBrowseId
 * 2. Call /browse with that browseId to get the actual lyrics
 */
router.get('/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw createHttpError(400, 'Invalid video ID');
  }

  // Step 1: Get the lyrics browseId from the /next endpoint
  const nextResponse = await innertube.next(videoId);
  const { lyricsBrowseId } = parseNextResponse(nextResponse);

  if (!lyricsBrowseId) {
    throw createHttpError(404, 'No lyrics available for this track');
  }

  // Step 2: Browse the lyrics page
  const lyricsResponse = await innertube.browse(lyricsBrowseId);
  const lyrics = parseLyricsResponse(lyricsResponse);

  if (!lyrics.lines.length) {
    throw createHttpError(404, 'Lyrics content is empty');
  }

  res.json({
    success: true,
    data: {
      videoId,
      ...lyrics,
    },
    error: null,
  });
}));

module.exports = router;
