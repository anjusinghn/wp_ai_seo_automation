import { Hono } from "hono";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_STATE = {
  lastPublishedDateIST: null,
  lastPublishResult: null,
  isPublishing: false,
};
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// ----- environment helpers --------------------------------------------------
function getConfig(env) {
  const required = [
    "FIRECRAWL_API_KEY",
    "GROQ_API_KEY",
    "WP_SITE_URL",
    "WP_USER",
    "WP_APP_PASSWORD",
  ];
  for (const key of required) {
    const value = env[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Missing required environment variable ${key}`);
    }
  }
  return {
    firecrawlApiKey: env.FIRECRAWL_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    wpSiteUrl: env.WP_SITE_URL,
    wpUser: env.WP_USER,
    wpPassword: env.WP_APP_PASSWORD,
    groqModel: (env.GROQ_MODEL && env.GROQ_MODEL.trim()) || "openai/gpt-oss-120b",
    userAgent: env.HTTP_USER_AGENT || DEFAULT_USER_AGENT,
  };
}

// ----- common helpers -------------------------------------------------------
const pickFirstNonEmpty = (...values) => {
