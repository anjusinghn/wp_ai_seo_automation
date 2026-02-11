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
