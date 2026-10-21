/**
 * Whether a request looks like it came from a program rather than a person.
 *
 * The user agent is read here and thrown away: the only thing that leaves this
 * function, and the only thing item_events stores, is the answer. Bots are
 * still recorded, flagged, so the admin screen can show what share of traffic
 * they are; filtering them out is the reader's job.
 *
 * Deliberately generous. A real browser always says "Mozilla/", so anything
 * without it is a script, and the named patterns catch the crawlers, link
 * unfurlers and headless browsers that do. A person wrongly flagged costs a
 * count; a crawler counted as a person inflates every number on the screen.
 *
 * Pure, so it can be tested with a table of user agents.
 */

const BOT_PATTERN = new RegExp(
  [
    // Crawlers, by the words they use for themselves.
    "bot\\b", "bot/", "crawl", "spider", "slurp", "scrap", "fetch", "archiver",
    "mediapartners", "adsbot", "feedburner", "yandex", "baidu", "sogou", "exabot",
    "duckduck", "petalbot", "bytespider", "ia_archiver", "semrush", "ahrefs", "mj12",
    // AI crawlers that don't say "bot" in a way the above catches.
    "gptbot", "chatgpt-user", "claude-web", "anthropic-ai", "perplexity", "ccbot",
    "cohere-ai", "google-extended", "meta-externalagent",
    // Link previews in chat apps and social sites.
    "facebookexternalhit", "facebot", "whatsapp", "telegram", "discord", "slack",
    "skypeuripreview", "embedly", "quora link preview", "pinterest", "vkshare",
    "iframely", "outbrain", "redditbot", "bingpreview", "google-inspectiontool",
    // Headless browsers and automation.
    "headless", "phantomjs", "puppeteer", "playwright", "selenium", "webdriver",
    "lighthouse", "chrome-lighthouse", "pagespeed", "gtmetrix", "pingdom",
    "uptimerobot", "statuscake", "site24x7", "newrelicpinger",
    // HTTP libraries.
    "curl/", "wget", "python", "aiohttp", "httpx", "go-http-client", "java/",
    "okhttp", "axios", "node-fetch", "undici", "libwww", "httpclient", "guzzle",
    "postman", "insomnia", "ruby", "perl", "php/",
  ].join("|"),
  "i",
);

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  // Every browser sends one, and every browser's starts this way.
  if (ua.length < 10 || !ua.startsWith("Mozilla/")) return true;
  return BOT_PATTERN.test(ua);
}
