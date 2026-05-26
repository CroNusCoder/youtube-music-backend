# YouTube Music Backend API

A complete REST API backend for YouTube Music, powered by YouTube's InnerTube API and yt-dlp for audio stream extraction. Built with Node.js and Express.

> **Disclaimer:** This project is for educational purposes. It uses YouTube Music's internal API which is not officially supported. Use responsibly and in accordance with YouTube's Terms of Service.

## Features

- 🔍 **Search** — songs, albums, artists, playlists, videos
- 🎵 **Audio Streaming** — extract or proxy best-quality audio via yt-dlp
- 🏠 **Home Feed** — personalized sections (Quick Picks, Trending, New Releases)
- 💿 **Album Details** — full track listing with metadata
- 🎤 **Artist Pages** — top songs, albums, singles, videos
- 📻 **Radio / Up Next** — auto-generated song queue
- 💡 **Search Suggestions** — real-time autocomplete
- 📝 **Lyrics** — synced and unsynced lyrics
- ⚡ **In-Memory Cache** — stream URLs cached with 4-hour TTL
- 🩺 **Health Check** — server status endpoint

## Prerequisites

- **Node.js** ≥ 18.x
- **yt-dlp** installed and available on your system PATH
  ```bash
  # Install yt-dlp
  pip install yt-dlp
  # or on Windows:
  winget install yt-dlp
  # or download from: https://github.com/yt-dlp/yt-dlp/releases
  ```

## Quick Start

```bash
# 1. Clone the repository
cd youtube-music-backend

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env

# 4. Start the server
npm run dev    # development (auto-reload with nodemon)
npm start      # production
```

The server starts at `http://localhost:3000` by default.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `YT_DLP_PATH` | `yt-dlp` | Path to yt-dlp binary |
| `CACHE_TTL_SECONDS` | `14400` | Stream URL cache TTL (4 hours) |
| `LOG_LEVEL` | `dev` | Morgan log format (`dev`, `combined`, `debug`) |

## API Endpoints

All responses follow this format:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

### Health Check
```
GET /api/health
```
```bash
curl http://localhost:3000/api/health
```

---

### 1. Search
```
GET /api/search?q={query}&filter={songs|albums|artists|playlists|videos}
```
```bash
# Search for songs
curl "http://localhost:3000/api/search?q=bohemian+rhapsody&filter=songs"

# Search all content types
curl "http://localhost:3000/api/search?q=taylor+swift"

# Search albums only
curl "http://localhost:3000/api/search?q=dark+side+of+the+moon&filter=albums"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "bohemian rhapsody",
    "filter": "songs",
    "resultCount": 20,
    "results": [
      {
        "title": "Bohemian Rhapsody",
        "videoId": "fJ9rUzIMcZQ",
        "browseId": null,
        "thumbnail": "https://lh3.googleusercontent.com/...",
        "artist": { "name": "Queen", "browseId": "UC..." },
        "album": { "name": "A Night at the Opera", "browseId": "MPREb_..." },
        "duration": "5:55",
        "durationSeconds": 355,
        "category": "Songs"
      }
    ]
  },
  "error": null
}
```

---

### 2. Get Stream URL
```
GET /api/stream/:videoId
GET /api/stream/:videoId?proxy=true
```
```bash
# Get the audio stream URL
curl http://localhost:3000/api/stream/fJ9rUzIMcZQ

# Proxy the audio through the server (pipe directly to a player)
curl http://localhost:3000/api/stream/fJ9rUzIMcZQ?proxy=true --output -
```

**Response (URL mode):**
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://rr3---sn-...",
    "format": "opus/webm",
    "bitrate": "128k",
    "formatId": "251",
    "expiresIn": 14400
  },
  "error": null
}
```

---

### 3. Home Feed
```
GET /api/home
```
```bash
curl http://localhost:3000/api/home
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sectionCount": 8,
    "sections": [
      {
        "title": "Quick picks",
        "items": [
          {
            "title": "Song Title",
            "subtitle": "Artist • Album",
            "thumbnail": "...",
            "videoId": "...",
            "browseId": null
          }
        ]
      }
    ]
  },
  "error": null
}
```

---

### 4. Album Details
```
GET /api/album/:browseId
```
```bash
# browseId typically starts with "MPREb_"
curl http://localhost:3000/api/album/MPREb_KFNMirqSiCe
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Album Title",
    "artist": "Artist Name",
    "year": "2023",
    "thumbnail": "...",
    "description": "...",
    "trackCount": 12,
    "tracks": [
      {
        "title": "Track 1",
        "artist": "Artist",
        "videoId": "...",
        "duration": "3:45",
        "durationSeconds": 225,
        "trackNumber": 1
      }
    ]
  },
  "error": null
}
```

---

### 5. Artist Page
```
GET /api/artist/:channelId
```
```bash
# channelId typically starts with "UC"
curl http://localhost:3000/api/artist/UCiMhD4jzUqG-IgPzUhMuNQ
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Artist Name",
    "description": "...",
    "thumbnail": "...",
    "subscriberCount": "10M subscribers",
    "topSongs": [...],
    "albums": [...],
    "singles": [...],
    "videos": [...]
  },
  "error": null
}
```

---

### 6. Up Next / Radio Queue
```
GET /api/next/:videoId
GET /api/next/:videoId?playlistId={playlistId}
```
```bash
curl http://localhost:3000/api/next/fJ9rUzIMcZQ
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentTrack": {
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "videoId": "fJ9rUzIMcZQ",
      "duration": "5:55"
    },
    "upNext": [...],
    "lyricsBrowseId": "MPLYt_...",
    "relatedBrowseId": "MPTRt_..."
  },
  "error": null
}
```

---

### 7. Search Suggestions
```
GET /api/suggestions?q={query}
```
```bash
curl "http://localhost:3000/api/suggestions?q=bohem"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "bohem",
    "suggestions": [
      "bohemian rhapsody",
      "bohemian rhapsody queen",
      "bohemian like you"
    ]
  },
  "error": null
}
```

---

### 8. Lyrics
```
GET /api/lyrics/:videoId
```
```bash
curl http://localhost:3000/api/lyrics/fJ9rUzIMcZQ
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "fJ9rUzIMcZQ",
    "synced": false,
    "lines": [
      { "text": "Is this the real life?" },
      { "text": "Is this just fantasy?" }
    ],
    "source": "LyricFind"
  },
  "error": null
}
```

## Project Structure

```
youtube-music-backend/
├── src/
│   ├── config/
│   │   └── constants.js        # InnerTube API config & constants
│   ├── lib/
│   │   ├── innertubeClient.js  # Core InnerTube HTTP client
│   │   ├── streamExtractor.js  # yt-dlp audio stream extraction
│   │   └── cache.js            # In-memory TTL cache
│   ├── parsers/
│   │   └── responseParser.js   # InnerTube response parsers
│   ├── routes/
│   │   ├── search.js           # GET /api/search
│   │   ├── stream.js           # GET /api/stream/:videoId
│   │   ├── home.js             # GET /api/home
│   │   ├── album.js            # GET /api/album/:browseId
│   │   ├── artist.js           # GET /api/artist/:channelId
│   │   ├── next.js             # GET /api/next/:videoId
│   │   ├── suggestions.js      # GET /api/suggestions
│   │   └── lyrics.js           # GET /api/lyrics/:videoId
│   ├── middleware/
│   │   └── errorHandler.js     # Error handling & async wrapper
│   └── app.js                  # Express app entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## How It Works

### InnerTube API
This server communicates with YouTube Music's internal API (`youtubei/v1`) by mimicking a WEB_REMIX client. No official YouTube Data API key or OAuth is required. The InnerTube client handles:
- Building the required context payload
- Setting proper headers (API key, Origin, Referer)
- Making POST requests to the correct endpoints

### Audio Streaming
Audio stream URLs are extracted using **yt-dlp**, which is called as a subprocess. The extracted URLs point directly to Google's CDN and expire after ~6 hours. Results are cached in memory with a 4-hour TTL to minimize yt-dlp calls.

### Response Parsing
InnerTube responses are deeply nested JSON with "renderer" objects. The `responseParser.js` module contains specialized parsers for each endpoint that normalize the data into clean, flat JSON objects.

## Error Handling

All errors return a consistent format:
```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Common HTTP status codes:
- `400` — Bad request (missing or invalid parameters)
- `404` — Not found (invalid browseId, no lyrics available, etc.)
- `500` — Server error (InnerTube API failure, yt-dlp error, etc.)

## License

MIT
