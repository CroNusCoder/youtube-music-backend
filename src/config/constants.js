/**
 * InnerTube API configuration constants.
 * Based on YouTube Music's WEB_REMIX client (the web player).
 */

const INNERTUBE_BASE_URL = 'https://music.youtube.com/youtubei/v1';

const INNERTUBE_API_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';

const INNERTUBE_CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20241023.01.00',
  hl: 'en',
  gl: 'US',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const INNERTUBE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': INNERTUBE_API_KEY,
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'User-Agent': INNERTUBE_CLIENT.userAgent,
};

/** Filter params for InnerTube search — these are base64-encoded protobuf filter strings */
const SEARCH_FILTERS = {
  songs: 'EgWKAQIIAWoMEAMQBBAJEA4QChAF',
  albums: 'EgWKAQIYAWoMEAMQBBAJEA4QChAF',
  artists: 'EgWKAQIgAWoMEAMQBBAJEA4QChAF',
  playlists: 'EgWKAQIoAWoMEAMQBBAJEA4QChAF',
  videos: 'EgWKAQIQAWoMEAMQBBAJEA4QChAF',
};

const BROWSE_IDS = {
  HOME: 'FEmusic_home',
  EXPLORE: 'FEmusic_explore',
  LIBRARY: 'FEmusic_liked_playlists',
  CHARTS: 'FEmusic_charts',
};

/** Default cache TTL for stream URLs in seconds (4 hours) */
const DEFAULT_CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS, 10) || 14400;

module.exports = {
  INNERTUBE_BASE_URL,
  INNERTUBE_API_KEY,
  INNERTUBE_CLIENT,
  INNERTUBE_HEADERS,
  SEARCH_FILTERS,
  BROWSE_IDS,
  DEFAULT_CACHE_TTL,
};
