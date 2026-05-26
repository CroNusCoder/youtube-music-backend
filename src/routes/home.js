'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseHomeResponse } = require('../parsers/responseParser');
const { asyncHandler } = require('../middleware/errorHandler');
const { BROWSE_IDS } = require('../config/constants');

const router = Router();

/**
 * GET /api/home
 *
 * Returns the YouTube Music home feed with sections like
 * Quick Picks, New Releases, Trending, etc.
 */
router.get('/', asyncHandler(async (req, res) => {
  const rawResponse = await innertube.browse(BROWSE_IDS.HOME);
  const sections = parseHomeResponse(rawResponse);

  res.json({
    success: true,
    data: {
      sectionCount: sections.length,
      sections,
    },
    error: null,
  });
}));

module.exports = router;
