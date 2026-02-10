import "dotenv/config";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

async function main() {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY in environment");
  }

  const url = "https://thehackernews.com/";
  const payload = {
    url,
    formats: ["links", "markdown", "html"],
    onlyMainContent: false,
  };

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
