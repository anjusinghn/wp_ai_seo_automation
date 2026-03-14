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
  }
}

function expandLinkCandidates(items) {
  if (!items) return [];
  const results = [];
  const visited = new Set();

  const visit = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      results.push({ url: value });
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    const url = pickFirstNonEmpty(
      value.url,
      value.href,
      value.link,
      value.permalink,
      value.sourceURL,
    );
    const title = pickFirstNonEmpty(
      value.title,
      value.text,
      value.name,
      value.heading,
      value.label,
      value.description,
    );

    if (url || title) results.push({ url, title });

    for (const child of Object.values(value)) visit(child);
  };

  visit(items);
  return results;
}

function deriveTitleFromUrl(urlString, fallback = "Article") {
  try {
    const { pathname } = new URL(urlString);
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.pop();
    if (!lastSegment) return fallback;
    const cleaned = lastSegment.replace(/\.[a-z]+$/i, "");
    const words = cleaned.replace(/[-_]+/g, " ").trim();
    if (!words) return fallback;
    return words.replace(/\b\w/g, (char) => char.toUpperCase());
  } catch (_) {
    return fallback;
  }
}

function normalizeHackerNewsLinks(items) {
  const candidates = Array.isArray(items) ? items : expandLinkCandidates(items);
  const list = [];
  const seen = new Set();

  const push = (title, url) => {
    const absolute = normalizeDomainArticleUrl(url, {
      domain: "https://thehackernews.com/",
      requireHtmlExtension: true,
    });
    if (!absolute) return;
    if (!absolute.includes("thehackernews.com")) return;
    const path = new URL(absolute).pathname.toLowerCase();
    if (!/\d{4}\/\d{2}\//.test(path)) return;
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const finalTitle =
      (title && title.trim()) || deriveTitleFromUrl(absolute, "The Hacker News Article");
    list.push({ title: finalTitle, url: absolute });
  };

  for (const item of candidates) {
    if (!item) continue;
    if (typeof item === "string") {
      push("", item);
      continue;
    }
    const candidateUrl = pickFirstNonEmpty(
      item.url,
      item.href,
      item.link,
      item.permalink,
      item.sourceURL,
    );
    const candidateTitle = pickFirstNonEmpty(
      item.title,
      item.text,
      item.name,
      item.heading,
      item.label,
      item.description,
    );
    push(candidateTitle, candidateUrl);
  }

  return list;
}

function extractMarkdownLinks(markdown, { baseUrl } = {}) {
  if (typeof markdown !== "string" || markdown.trim() === "") return [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  while ((match = regex.exec(markdown))) {
    const text = match[1]?.trim();
    const href = match[2]?.trim();
    if (!text || !href) continue;
    let absolute = href;
    if (baseUrl) {
      try {
        absolute = new URL(href, baseUrl).toString();
      } catch (_) {
        continue;
      }
    }
    links.push({ text, url: absolute });
  }
  return links;
}

function collectHackerNewsLinksFromMetadata(metadata) {
  return normalizeHackerNewsLinks(metadata);
}

function collectHackerNewsLinksFromHtml(html) {
  if (typeof html !== "string" || html.trim() === "") return [];
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  const tagsRegex = /<[^>]+>/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(html))) {
    const href = match[1];
    const text = match[2].replace(tagsRegex, "").trim();
    links.push({ url: href, title: text });
  }
  return normalizeHackerNewsLinks(links);
}

function collectHackerNewsLinksFromText(text) {
  if (typeof text !== "string" || text.trim() === "") return [];
  const regex = /https?:\/\/(?:www\.)?thehackernews\.com\/[^\s"'()]+/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(text))) {
    matches.push({ url: match[0] });
  }
  return normalizeHackerNewsLinks(matches);
}

function createLinkAggregator(normalizeFn) {
  const seen = new Set();
  const list = [];
  return {
    add(items) {
      const normalized = normalizeFn(items);
      for (const link of normalized) {
        if (seen.has(link.url)) continue;
        seen.add(link.url);
        list.push(link);
      }
    },
    all() {
      return list.slice();
    },
  };
}

function harvestHackerNewsScrape(scrape, aggregator) {
  if (!scrape || !aggregator) return;
  const markdown = pickFirstNonEmpty(scrape.summary, scrape.markdown, scrape.rawText);
  const html = scrape.html || "";
  const rawText = pickFirstNonEmpty(scrape.rawText, scrape.summary, "");

  aggregator.add(scrape.links);
  aggregator.add(collectHackerNewsLinksFromMetadata(scrape.metadata));
  aggregator.add(collectHackerNewsLinksFromHtml(html));
  aggregator.add(
    extractMarkdownLinks(markdown, { baseUrl: "https://thehackernews.com/" }).map(
      ({ text, url }) => ({ title: text, url }),
    ),
  );
  aggregator.add(collectHackerNewsLinksFromText(html));
  aggregator.add(collectHackerNewsLinksFromText(markdown));
  aggregator.add(collectHackerNewsLinksFromText(rawText));

  const documents = Array.isArray(scrape.documents) ? scrape.documents : [];
  for (const doc of documents) {
    if (!doc) continue;
    const docMarkdown = pickFirstNonEmpty(doc.summary, doc.markdown, doc.rawText);
    const docHtml = doc.html || "";
    const docRaw = pickFirstNonEmpty(doc.rawText, doc.summary, doc.markdown, "");
    aggregator.add(doc.links);
    aggregator.add(collectHackerNewsLinksFromMetadata(doc.metadata));
    aggregator.add(collectHackerNewsLinksFromHtml(docHtml));
    aggregator.add(collectHackerNewsLinksFromText(docRaw));
    aggregator.add(
      extractMarkdownLinks(docMarkdown, { baseUrl: "https://thehackernews.com/" }).map(
        ({ text, url }) => ({ title: text, url }),
      ),
    );
  }
}

// ----- firecrawl ------------------------------------------------------------
async function firecrawlScrape(env, url, { formats = ["summary", "html", "links"] } = {}) {
  const { firecrawlApiKey } = getConfig(env);
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats, onlyMainContent: false }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status} ${text}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(String(json.error));
  const normalized = normalizeFirecrawlPayload(json);
  console.log(
    `firecrawlScrape: ${url} (docs=${normalized.documents.length}, links=${normalized.links.length})`,
  );
  return normalized;
}

async function firecrawlStartCrawl(env, url) {
  const { firecrawlApiKey } = getConfig(env);
  const res = await fetch(`${FIRECRAWL_BASE}/crawl`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      limit: 1,
      crawlEntireDomain: false,
      scrapeOptions: {
        formats: ["summary", "html", "links"],
        onlyMainContent: false,
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Firecrawl crawl start ${res.status} ${text}`);
  return JSON.parse(text);
}

async function firecrawlPoll(env, jobId, { timeoutMs = 45000, intervalMs = 1500 } = {}) {
  const { firecrawlApiKey } = getConfig(env);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${FIRECRAWL_BASE}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${firecrawlApiKey}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Firecrawl poll ${res.status} ${text}`);
    const json = JSON.parse(text);
    const done =
      json.status === "completed" ||
      json.success === true ||
      Array.isArray(json.data) ||
      Array.isArray(json.documents);
    if (done) return json;
    await sleep(intervalMs);
  }
  throw new Error("Firecrawl poll timed out");
}

function normalizeFirecrawlPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      summary: "",
      markdown: "",
      html: "",
      title: "",
      description: "",
      rawText: "",
      metadata: null,
      links: [],
      documents: [],
    };
  }

  const documents = [];
  const visited = new Set();
  const addDoc = (doc) => {
    if (!doc || typeof doc !== "object") return;
    if (visited.has(doc)) return;
