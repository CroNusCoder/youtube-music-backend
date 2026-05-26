'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseAlbumResponse } = require('../parsers/responseParser');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

const router = Router();

/**
 * GET /api/album/:browseId
 *
 * Returns full album details including track listing.
 * browseId format: typically starts with "MPREb_"
 */
router.get('/:browseId', asyncHandler(async (req, res) => {
  const { browseId } = req.params;

  if (!browseId) {
    throw createHttpError(400, 'Album browseId is required');
  }

  const rawResponse = await innertube.browse(browseId);
  const album = parseAlbumResponse(rawResponse);

  if (!album.title) {
    throw createHttpError(404, 'Album not found or invalid browseId');
  }

  res.json({
    success: true,
    data: album,
    error: null,
  });
}));

module.exports = router;
