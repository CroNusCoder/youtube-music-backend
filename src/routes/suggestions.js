'use strict';

const { Router } = require('express');
const innertube = require('../lib/innertubeClient');
const { parseSuggestionsResponse } = require('../parsers/responseParser');
const { asyncHandler, createHttpError } = require('../middleware/errorHandler');

const router = Router();

/**
 * GET /api/suggestions?q={query}
 *
 * Returns autocomplete / search suggestions from YouTube Music.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    throw createHttpError(400, 'Query parameter "q" is required');
  }

  const rawResponse = await innertube.getSearchSuggestions(q.trim());
  const suggestions = parseSuggestionsResponse(rawResponse);

  res.json({
    success: true,
    data: {
      query: q.trim(),
      suggestions,
    },
    error: null,
  });
}));

module.exports = router;
