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
