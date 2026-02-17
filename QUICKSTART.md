# Quick Start Guide

Get your AI SEO Blog Automation up and running in 5 minutes!

## Step 1: Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

Required variables:
- `FIRECRAWL_API_KEY` - Get from https://firecrawl.dev
- `GROQ_API_KEY` - Get from https://console.groq.com
- `WP_SITE_URL` - Your WordPress site URL (e.g., https://yoursite.com/blog)
- `WP_USER` - Your WordPress username
- `WP_APP_PASSWORD` - WordPress Application Password (not regular password!)

### Creating WordPress Application Password

1. Log into WordPress admin
2. Go to Users → Profile
3. Scroll to "Application Passwords"
4. Enter a name (e.g., "AI SEO Bot")
5. Click "Add New Application Password"
6. Copy the generated password to your `.env` file

## Step 2: Start the Server

```bash
node index.js
```

You should see:

```
╔════════════════════════════════════════════════════════════╗
║   🚀 AI SEO Blog Automation Server                         ║
╠════════════════════════════════════════════════════════════╣
║   Server: http://localhost:8787                            ║
║   Daily Post Time: 10:00                                   ║
...
```

## Step 3: Populate the Queue

In a new terminal, fetch URLs from SecurityWeek:

```bash
curl -X POST http://localhost:8787/fetch-urls
```

This will scrape SecurityWeek and add URLs 5-13 to your queue (9 URLs total).
