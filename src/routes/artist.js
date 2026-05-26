'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseArtistResponse } = require('../parsers/responseParser');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

const router = Router();

/**
 * GET /api/artist/:channelId
 *
 * Returns artist page with top songs, albums, singles, and videos.
 * channelId format: typically starts with "UC"
 */
router.get('/:channelId', asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw createHttpError(400, 'Artist channelId is required');
  }

  const rawResponse = await innertube.browse(channelId);
  const artist = parseArtistResponse(rawResponse);

  if (!artist.name) {
    throw createHttpError(404, 'Artist not found or invalid channelId');
  }

  res.json({
    success: true,
    data: artist,
    error: null,
  });
}));

module.exports = router;
