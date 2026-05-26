'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseNextResponse } = require('../parsers/responseParser');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

const router = Router();

/**
 * GET /api/next/:videoId
 *
 * Returns the "up next" / radio queue for a given video.
 * Also provides the lyricsBrowseId needed for the /lyrics endpoint.
 */
router.get('/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw createHttpError(400, 'Invalid video ID');
  }

  const playlistId = req.query.playlistId || null;
  const rawResponse = await innertube.next(videoId, playlistId);
  const parsed = parseNextResponse(rawResponse);

  res.json({
    success: true,
    data: parsed,
    error: null,
  });
}));

module.exports = router;
