# Changes Summary

## What Was Fixed

### Problem
The Firecrawl extract API was failing with errors about unrecognized keys:
```
Firecrawl extract rejected keys [prompt,schema,url]; trying next shape
Firecrawl extract rejected keys [prompt,schema,page]; trying next shape
...
SecurityWeek extract failed: Firecrawl extract 400 BAD_REQUEST
```

### Solution
**Removed the Firecrawl extract function entirely** and replaced it with a simpler scraping approach that uses only the crawl API to get the markdown/HTML content, then parses it for URLs.

## New Features Added

### 1. Queue System (FIFO)
- URLs are stored in `url_queue.json`
- First In, First Out ordering
- Automatically refetches when empty
- Persistent storage between restarts

### 2. URL Selection Logic
- Scrapes SecurityWeek homepage
- Extracts URLs at positions **5-13** (9 URLs total)
- Logs all selected URLs for visibility
- Skips the first 4 URLs (typically ads or sticky posts)

### 3. Daily Automated Posting
- Runs continuously as a worker
- Checks every hour if it's time to post
- Posts at configured hour (default: 10 AM)
- Only posts once per day
- Automatically pulls from queue

### 4. New API Endpoints

#### `GET /queue-status`
Check the current queue:
```bash
curl http://localhost:8787/queue-status
```

Response:
```json
{
  "ok": true,
  "queue": {
    "count": 9,
    "urls": [...],
    "lastFetched": "2025-10-08T10:00:00.000Z",
    "isEmpty": false
  }
}
```

#### `POST /fetch-urls`
Manually fetch URLs from SecurityWeek:
```bash
curl -X POST http://localhost:8787/fetch-urls
```

Response:
```json
{
  "ok": true,
  "message": "Added 9 URLs to queue",
  "queueCount": 9,
  "urls": [...]
}
```

#### `POST /post-from-queue`
Post one article from the queue on demand:
```bash
# Publish
curl -X POST http://localhost:8787/post-from-queue \
  -H "Content-Type: application/json" \
  -d '{"publish": true}'

# Draft
curl -X POST http://localhost:8787/post-from-queue \
  -H "Content-Type: application/json" \
  -d '{"publish": false}'
```

Response:
```json
{
  "ok": true,
  "success": true,
  "sourceUrl": "https://www.securityweek.com/...",
  "sourceTitle": "Article Title",
  "postId": 123,
  "postLink": "https://yoursite.com/blog/...",
  "queueRemaining": 8
}
```

### 5. Enhanced Logging
The system now logs:
- URL selection (positions 5-13)
- Queue operations (add, pop, status)
- Daily post triggers
- Complete workflow for each post

Example log:
```
Found 50 total links
Selected URLs 5-13 (9 URLs):
  5. https://www.securityweek.com/article-1/
  6. https://www.securityweek.com/article-2/
  ...
  13. https://www.securityweek.com/article-9/

=== Starting post from queue ===
Processing URL: https://www.securityweek.com/...
Scraping article content...
Summary length: 2500 chars
Generating blog post with Groq...
Generated title: ...
Posting to WordPress (status: publish)...
✓ Posted! Post ID: 123
URLs remaining in queue: 8
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SecurityWeek.com                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Scrape URLs 5-13
                  │ (Firecrawl Crawl API)
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Queue (url_queue.json)                   │
│                                                              │
│  [URL 1] → [URL 2] → [URL 3] → ... → [URL 9]               │
│   FIFO (First In, First Out)                                │
└─────────────────┬───────────────────────────────────────────┘
