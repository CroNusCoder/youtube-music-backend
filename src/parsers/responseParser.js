'use strict';

// ─── Utility Helpers ──────────────────────────────────────────────────

/**
 * Safely navigate nested objects. Returns undefined if any key is missing.
 * @param {object} obj
 * @param  {...string} keys
 * @returns {*}
 */
function dig(obj, ...keys) {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Extract text from an InnerTube `runs` array or `simpleText` field.
 * @param {object} textObj — e.g. { runs: [{ text: 'Hello' }] } or { simpleText: 'Hello' }
 * @returns {string}
 */
function extractText(textObj) {
  if (!textObj) return '';
  if (textObj.simpleText) return textObj.simpleText;
  if (textObj.runs) return textObj.runs.map((r) => r.text).join('');
  return '';
}

/**
 * Extract the best available thumbnail URL from a thumbnails array.
 * @param {object} thumbObj — e.g. { thumbnails: [{ url, width, height }] }
 * @returns {string}
 */
function extractThumbnail(thumbObj) {
  if (!thumbObj?.thumbnails?.length) return '';
  // Return the largest thumbnail
  const sorted = [...thumbObj.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  let url = sorted[0].url;
  // InnerTube sometimes returns protocol-relative URLs
  if (url.startsWith('//')) url = `https:${url}`;
  return url;
}

/**
 * Extract a navigation endpoint's browseId or videoId from a renderer.
 * @param {object} item
 * @returns {{ videoId?: string, browseId?: string, playlistId?: string }}
 */
function extractNavigation(item) {
  const nav = dig(item, 'navigationEndpoint');
  const result = {};
  if (dig(nav, 'watchEndpoint', 'videoId')) {
    result.videoId = nav.watchEndpoint.videoId;
    if (nav.watchEndpoint.playlistId) result.playlistId = nav.watchEndpoint.playlistId;
  }
  if (dig(nav, 'browseEndpoint', 'browseId')) {
    result.browseId = nav.browseEndpoint.browseId;
  }
  return result;
}

/**
 * Parse duration text (e.g. "3:45" or "1:02:30") to total seconds.
 * @param {string} text
 * @returns {number}
 */
function parseDuration(text) {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// ─── Search Results Parser ────────────────────────────────────────────

/**
 * Parse a musicResponsiveListItemRenderer into a normalized result.
 * Works for songs, videos, albums, artists depending on context.
 */
function parseSearchItem(renderer) {
  if (!renderer) return null;

  const flexColumns = renderer.flexColumns || [];
  const fixedColumns = renderer.fixedColumns || [];

  // Title is always in the first flex column
  const titleRuns = dig(flexColumns, 0, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs') || [];
  const title = titleRuns.map((r) => r.text).join('');

  // Navigation from the title run (for videoId/browseId)
  const titleNav = extractNavigation(titleRuns[0] || {});

  // Secondary info (artist, album, duration etc.) is in the second flex column
  const secondaryRuns = dig(flexColumns, 1, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs') || [];

  // Duration might be in a fixed column
  const durationText = extractText(
    dig(fixedColumns, 0, 'musicResponsiveListItemFixedColumnRenderer', 'text')
  );

  // Extract artist and album from secondary runs
  // Typical pattern: "Song • Artist • Album" or "Artist • 2023 • Album"
  const secondaryTexts = secondaryRuns
    .filter((r) => r.text !== ' • ' && r.text !== ' & ')
    .map((r) => ({
      text: r.text,
      ...extractNavigation(r),
    }));

  // Thumbnail
  const thumbnail = extractThumbnail(
    dig(renderer, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail')
  );

  // Overlay / playback
  const overlay = dig(renderer, 'overlay', 'musicItemThumbnailOverlayRenderer',
    'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchEndpoint');

  const videoId = titleNav.videoId || overlay?.videoId || null;
  const browseId = titleNav.browseId || null;

  // Build the result — different shapes for different types
  const result = {
    title,
    videoId,
    browseId,
    thumbnail,
  };

  // Try to identify artist (usually has a browseId starting with 'UC')
  const artistInfo = secondaryTexts.find((t) => t.browseId?.startsWith('UC'));
  if (artistInfo) {
    result.artist = { name: artistInfo.text, browseId: artistInfo.browseId };
  } else if (secondaryTexts.length > 0) {
    result.artist = { name: secondaryTexts[0]?.text || '' };
  }

  // Try to identify album (usually has a browseId starting with 'MPRE')
  const albumInfo = secondaryTexts.find((t) => t.browseId?.startsWith('MPRE'));
  if (albumInfo) {
    result.album = { name: albumInfo.text, browseId: albumInfo.browseId };
  }

  // Duration
  if (durationText) {
    result.duration = durationText;
    result.durationSeconds = parseDuration(durationText);
  }

  return result;
}

/**
 * Parse InnerTube search response into a clean array of results.
 * @param {object} response — raw InnerTube /search response
 * @returns {Array<object>}
 */
function parseSearchResponse(response) {
  const results = [];

  // Navigate to the shelf contents
  const tabs = dig(response, 'contents', 'tabbedSearchResultsRenderer', 'tabs') || [];
  for (const tab of tabs) {
    const sections = dig(tab, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') || [];
    for (const section of sections) {
      const shelf = section.musicShelfRenderer;
      if (!shelf) continue;

      const shelfTitle = extractText(shelf.title);
      const items = shelf.contents || [];

      for (const item of items) {
        const parsed = parseSearchItem(item.musicResponsiveListItemRenderer);
        if (parsed) {
          parsed.category = shelfTitle; // e.g. "Songs", "Albums", "Artists"
          results.push(parsed);
        }
      }
    }
  }

  return results;
}

// ─── Home Feed Parser ─────────────────────────────────────────────────

/**
 * Parse a musicTwoRowItemRenderer (used in carousels).
 */
function parseTwoRowItem(renderer) {
  if (!renderer) return null;

  const title = extractText(renderer.title);
  const subtitle = extractText(renderer.subtitle);
  const thumbnail = extractThumbnail(
    dig(renderer, 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail')
  );
  const nav = extractNavigation(renderer);

  return { title, subtitle, thumbnail, ...nav };
}

/**
 * Parse InnerTube home/browse response into sections.
 * @param {object} response — raw InnerTube /browse response
 * @returns {Array<{ title: string, items: Array }>}
 */
function parseHomeResponse(response) {
  const sections = [];

  const contents =
    dig(response, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0,
      'tabRenderer', 'content', 'sectionListRenderer', 'contents') || [];

  for (const section of contents) {
    // Carousel shelves (most common on home)
    const carousel = section.musicCarouselShelfRenderer;
    if (carousel) {
      const sectionTitle = extractText(dig(carousel, 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title'));

      const items = (carousel.contents || []).map((item) => {
        // Can be musicTwoRowItemRenderer or musicResponsiveListItemRenderer
        if (item.musicTwoRowItemRenderer) {
          return parseTwoRowItem(item.musicTwoRowItemRenderer);
        }
        if (item.musicResponsiveListItemRenderer) {
          return parseSearchItem(item.musicResponsiveListItemRenderer);
        }
        return null;
      }).filter(Boolean);

      sections.push({ title: sectionTitle, items });
      continue;
    }

    // Immersive carousel (hero banners)
    const immersive = section.musicImmersiveCarouselShelfRenderer;
    if (immersive) {
      const sectionTitle = extractText(dig(immersive, 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title'));
      const items = (immersive.contents || []).map((item) => {
        if (item.musicTwoRowItemRenderer) {
          return parseTwoRowItem(item.musicTwoRowItemRenderer);
        }
        return null;
      }).filter(Boolean);

      sections.push({ title: sectionTitle || 'Featured', items });
    }
  }

  return sections;
}

// ─── Album Parser ─────────────────────────────────────────────────────

/**
 * Parse InnerTube album browse response.
 * @param {object} response — raw InnerTube /browse response for an album
 * @returns {object} — { title, artist, year, thumbnail, description, trackCount, duration, tracks[] }
 */
function parseAlbumResponse(response) {
  // Header can be in different renderers
  const immersiveHeader = dig(response, 'header', 'musicImmersiveHeaderRenderer');
  const detailHeader = dig(response, 'header', 'musicDetailHeaderRenderer');
  // Also try the new responsive header
  const responsiveHeader = dig(response, 'header', 'musicResponsiveHeaderRenderer');
  const header = immersiveHeader || detailHeader || responsiveHeader || {};

  const title = extractText(header.title);
  const thumbnail = extractThumbnail(
    dig(header, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail') ||
    dig(header, 'thumbnail', 'croppedSquareThumbnailRenderer', 'thumbnail')
  );

  // Subtitle usually contains: "Album • Artist • Year"
  const subtitleRuns = dig(header, 'subtitle', 'runs') || [];
  const subtitleParts = subtitleRuns.filter((r) => r.text !== ' • ' && r.text !== ' \u2022 ').map((r) => r.text);
  const artist = subtitleParts[1] || '';
  const year = subtitleParts[2] || '';

  // Description
  const description = extractText(
    dig(header, 'description', 'musicDescriptionShelfRenderer', 'description') ||
    header.description
  );

  // Menu items — we can get playlistId from strapline or menu
  const straplineRuns = dig(header, 'straplineTextOne', 'runs') || [];

  // Tracks
  const trackSections =
    dig(response, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0,
      'tabRenderer', 'content', 'sectionListRenderer', 'contents') || [];

  const tracks = [];
  for (const section of trackSections) {
    const shelf = section.musicShelfRenderer;
    if (!shelf) continue;
    for (const item of shelf.contents || []) {
      const r = item.musicResponsiveListItemRenderer;
      if (!r) continue;

      const flexColumns = r.flexColumns || [];
      const fixedColumns = r.fixedColumns || [];

      const trackTitle = extractText(
        dig(flexColumns, 0, 'musicResponsiveListItemFlexColumnRenderer', 'text')
      );
      const trackArtistRuns = dig(flexColumns, 1, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs') || [];
      const trackArtist = trackArtistRuns.map((run) => run.text).filter((t) => t !== ' & ' && t !== ' • ').join(', ');

      const durationText = extractText(
        dig(fixedColumns, 0, 'musicResponsiveListItemFixedColumnRenderer', 'text')
      );

      // Get videoId from the overlay or navigation
      const overlay = dig(r, 'overlay', 'musicItemThumbnailOverlayRenderer',
        'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchEndpoint');

      tracks.push({
        title: trackTitle,
        artist: trackArtist,
        videoId: overlay?.videoId || null,
        playlistId: overlay?.playlistId || null,
        duration: durationText,
        durationSeconds: parseDuration(durationText),
        trackNumber: tracks.length + 1,
      });
    }
  }

  return {
    title,
    artist,
    year,
    thumbnail,
    description,
    trackCount: tracks.length,
    tracks,
  };
}

// ─── Artist Parser ────────────────────────────────────────────────────

/**
 * Parse InnerTube artist browse response.
 * @param {object} response — raw InnerTube /browse response for an artist channel
 * @returns {object}
 */
function parseArtistResponse(response) {
  // Artist header
  const header =
    dig(response, 'header', 'musicImmersiveHeaderRenderer') ||
    dig(response, 'header', 'musicVisualHeaderRenderer') ||
    dig(response, 'header', 'musicResponseHeaderRenderer') || {};

  const name = extractText(header.title);
  const description = extractText(header.description);
  const thumbnail = extractThumbnail(
    dig(header, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail')
  );
  const subscriberCount = extractText(header.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText);

  // Sections (top songs, albums, singles, videos, etc.)
  const sectionContents =
    dig(response, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0,
      'tabRenderer', 'content', 'sectionListRenderer', 'contents') || [];

  const result = {
    name,
    description,
    thumbnail,
    subscriberCount,
    topSongs: [],
    albums: [],
    singles: [],
    videos: [],
    playlists: [],
  };

  for (const section of sectionContents) {
    const shelf = section.musicShelfRenderer;
    const carousel = section.musicCarouselShelfRenderer;

    if (shelf) {
      // Top songs are usually in a musicShelfRenderer
      const shelfTitle = extractText(shelf.title).toLowerCase();
      const items = (shelf.contents || []).map((item) =>
        parseSearchItem(item.musicResponsiveListItemRenderer)
      ).filter(Boolean);

      if (shelfTitle.includes('song')) {
        result.topSongs = items;
      }
    }

    if (carousel) {
      const carouselTitle = extractText(
        dig(carousel, 'header', 'musicCarouselShelfBasicHeaderRenderer', 'title')
      ).toLowerCase();

      const items = (carousel.contents || []).map((item) => {
        if (item.musicTwoRowItemRenderer) {
          return parseTwoRowItem(item.musicTwoRowItemRenderer);
        }
        if (item.musicResponsiveListItemRenderer) {
          return parseSearchItem(item.musicResponsiveListItemRenderer);
        }
        return null;
      }).filter(Boolean);

      if (carouselTitle.includes('album')) {
        result.albums = items;
      } else if (carouselTitle.includes('single')) {
        result.singles = items;
      } else if (carouselTitle.includes('video')) {
        result.videos = items;
      } else if (carouselTitle.includes('playlist') || carouselTitle.includes('featuring')) {
        result.playlists = items;
      }
    }
  }

  return result;
}

// ─── Next / Up Next Parser ────────────────────────────────────────────

/**
 * Parse InnerTube /next response for the "up next" queue and lyrics tab.
 * @param {object} response
 * @returns {{ currentTrack: object, upNext: Array, lyricsBrowseId: string|null, relatedBrowseId: string|null }}
 */
function parseNextResponse(response) {
  const tabs =
    dig(response, 'contents', 'singleColumnMusicWatchNextResultsRenderer',
      'tabbedRenderer', 'watchNextTabbedResultsRenderer', 'tabs') || [];

  let upNext = [];
  let lyricsBrowseId = null;
  let relatedBrowseId = null;
  let currentTrack = null;

  for (const tab of tabs) {
    const tabRenderer = tab.tabRenderer;
    if (!tabRenderer) continue;

    const tabTitle = extractText(tabRenderer.title).toLowerCase();

    if (tabTitle === 'up next') {
      // Parse the playlist panel
      const panelContents =
        dig(tabRenderer, 'content', 'musicQueueRenderer', 'content',
          'playlistPanelRenderer', 'contents') || [];

      for (const item of panelContents) {
        const pr = item.playlistPanelVideoRenderer;
        if (!pr) continue;

        const trackTitle = extractText(pr.title);
        const longByline = extractText(pr.longBylineText);
        const shortByline = extractText(pr.shortBylineText);
        const thumb = extractThumbnail(pr.thumbnail);
        const videoId = pr.videoId || dig(pr, 'navigationEndpoint', 'watchEndpoint', 'videoId');
        const durationText = extractText(pr.lengthText);

        const track = {
          title: trackTitle,
          artist: shortByline || longByline,
          thumbnail: thumb,
          videoId,
          duration: durationText,
          durationSeconds: parseDuration(durationText),
        };

        if (!currentTrack) {
          currentTrack = track; // First item is the current track
        }
        upNext.push(track);
      }
    }

    if (tabTitle === 'lyrics') {
      // The lyrics tab has a browseEndpoint we need to call separately
      lyricsBrowseId = dig(tabRenderer, 'endpoint', 'browseEndpoint', 'browseId') || null;
    }

    if (tabTitle === 'related') {
      relatedBrowseId = dig(tabRenderer, 'endpoint', 'browseEndpoint', 'browseId') || null;
    }
  }

  return { currentTrack, upNext, lyricsBrowseId, relatedBrowseId };
}

// ─── Lyrics Parser ────────────────────────────────────────────────────

/**
 * Parse InnerTube /browse response for lyrics.
 * @param {object} response
 * @returns {{ synced: boolean, lines: Array<{ text: string, startTimeMs?: number }>, source: string }}
 */
function parseLyricsResponse(response) {
  const contents =
    dig(response, 'contents', 'sectionListRenderer', 'contents') || [];

  // Check for timed lyrics (musicSyncedLyricsRenderer) — YouTube Music sometimes provides these
  for (const section of contents) {
    const syncedRenderer = section.musicSyncedLyricsRenderer;
    if (syncedRenderer) {
      const lines = (syncedRenderer.lyrics || []).map((line) => ({
        text: extractText(line.lyricLine),
        startTimeMs: parseInt(line.cueRange?.startTimeMilliseconds, 10) || 0,
      }));

      return {
        synced: true,
        lines,
        source: extractText(syncedRenderer.footer) || 'YouTube Music',
      };
    }
  }

  // Fallback to unsynced lyrics (musicDescriptionShelfRenderer)
  for (const section of contents) {
    const descShelf = section.musicDescriptionShelfRenderer;
    if (descShelf) {
      const lyricsText = extractText(descShelf.description);
      const source = extractText(descShelf.footer);

      const lines = lyricsText.split('\n').map((text) => ({ text }));

      return {
        synced: false,
        lines,
        source: source || 'YouTube Music',
      };
    }
  }

  return { synced: false, lines: [], source: '' };
}

// ─── Suggestions Parser ──────────────────────────────────────────────

/**
 * Parse search suggestions response.
 * @param {object} response
 * @returns {string[]}
 */
function parseSuggestionsResponse(response) {
  const suggestions = [];
  const contents = dig(response, 'contents') || [];

  for (const item of contents) {
    const renderer = item.searchSuggestionsSectionRenderer;
    if (!renderer) continue;

    for (const entry of renderer.contents || []) {
      const suggestion = entry.searchSuggestionRenderer;
      if (suggestion) {
        suggestions.push(extractText(suggestion.suggestion));
      }
    }
  }

  return suggestions;
}

module.exports = {
  // Main parsers
  parseSearchResponse,
  parseHomeResponse,
  parseAlbumResponse,
  parseArtistResponse,
  parseNextResponse,
  parseLyricsResponse,
  parseSuggestionsResponse,
  // Utility (exported for testing / advanced use)
  extractText,
  extractThumbnail,
  extractNavigation,
  parseDuration,
  dig,
};
