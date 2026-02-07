import { Hono } from "hono";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
