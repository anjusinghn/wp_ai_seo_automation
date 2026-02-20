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
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getISTComponents = (date = new Date()) => {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const iso = istDate.toISOString();
  const dateKey = iso.split("T")[0];
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  return { dateKey, hour, minute };
};

function normalizeDomainArticleUrl(rawUrl, { domain, requireHtmlExtension = false }) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let working = rawUrl.trim();
  if (working === "") return null;

  const match = working.match(/https?:\/\/[^\s"'()]+/i);
  if (match) working = match[0];

  if (requireHtmlExtension) {
    const lower = working.toLowerCase();
    const htmlIndex = lower.indexOf(".html");
    if (htmlIndex === -1) return null;
    working = working.slice(0, htmlIndex + 5);
  }

  try {
    const absolute = new URL(working, domain).toString();
    if (requireHtmlExtension && !absolute.toLowerCase().endsWith(".html")) return null;
    return absolute;
  } catch (_) {
    return null;
