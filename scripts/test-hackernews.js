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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);

  if (!res.ok) {
    console.log(text.slice(0, 500));
    throw new Error(`Firecrawl scrape failed with status ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error("Response was not valid JSON");
    console.error(text.slice(0, 500));
    throw err;
  }

  const links = Array.isArray(json.links) ? json.links : [];
  console.log(`links count: ${links.length}`);
