/**
 * Dependency-free technical SEO monitor for Phillips English.
 * Audits files that are intentionally published in sitemap.xml.
 * This is not a substitute for Google Search Console data or a live crawl.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://www.phillipsenglish.com";
const siteMap = readFileSync(join(root, "sitemap.xml"), "utf8");
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const rewrites = new Map((config.rewrites || [])
  .filter(rule => !rule.has && !rule.missing && !rule.source.includes(":"))
  .map(rule => [rule.source, rule.destination]));
const urls = [...siteMap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]);
const errors = [];
const warnings = [];
const titleSeen = new Map();
const canonicalSeen = new Map();

function attr(tag, name) {
  const pattern = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
  const match = tag.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
}
function findTag(html, tagName, attribute, value) {
  return [...html.matchAll(new RegExp("<" + tagName + "\\b[^>]*>", "gi"))]
    .map(m => m[0]).find(tag => attr(tag, attribute).toLowerCase() === value.toLowerCase());
}
function clean(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function sourceFor(url) {
  let path;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== base) return { error: "unexpected origin " + parsed.origin };
    path = decodeURIComponent(parsed.pathname);
  } catch { return { error: "invalid sitemap URL" }; }
  if (path === "/") path = "/index.html";
  else if (rewrites.has(path)) path = rewrites.get(path);
  else if (path.endsWith("/")) path += "index.html";
  else if (!extname(path) && existsSync(join(root, path + ".html"))) path += ".html";
  const file = resolve(root, "." + path);
  if (!file.startsWith(root + sep)) return { error: "path outside repository" };
  if (!existsSync(file)) return { error: "file not found: " + path };
  return { file, path };
}
for (const url of urls) {
  const source = sourceFor(url);
  if (source.error) { errors.push(url + ": " + source.error); continue; }
  const html = readFileSync(source.file, "utf8");
  const title = clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = attr(findTag(html, "meta", "name", "description") || "", "content").trim();
  const robots = attr(findTag(html, "meta", "name", "robots") || "", "content");
  const canonical = attr(findTag(html, "link", "rel", "canonical") || "", "href");
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";

  if (!title) errors.push(url + ": missing title");
  if (!description) warnings.push(url + ": missing meta description");
  if (!clean(h1)) warnings.push(url + ": missing H1 heading");
  if (!canonical) errors.push(url + ": missing canonical URL");
  else if (canonical !== url) warnings.push(url + ": canonical differs (" + canonical + ")");
  if (/noindex/i.test(robots)) errors.push(url + ": noindex page included in sitemap");

  if (title.length > 65) warnings.push(url + ": title length " + title.length + " characters (review, not an automatic error)");
  if (description.length > 165) warnings.push(url + ": long meta description (" + description.length + " characters)");
  if (title) {
    const existing = titleSeen.get(title);
    if (existing) warnings.push(url + ": duplicate title with " + existing);
    else titleSeen.set(title, url);
  }
  if (canonical) {
    const existing = canonicalSeen.get(canonical);
    if (existing) warnings.push(url + ": canonical shared with " + existing);
    else canonicalSeen.set(canonical, url);
  }
}
if (!urls.length) errors.push("Sitemap contains no URLs.");
if (new Set(urls).size !== urls.length) errors.push("Sitemap contains duplicate URLs.");

const lines = [
  "# Phillips English — scheduled technical SEO audit",
  "",
  "Generated: " + new Date().toISOString(),
  "",
  "Pages listed in sitemap: **" + urls.length + "**",
  "",
  "Critical checks: **" + errors.length + " errors**",
  "Review items: **" + warnings.length + " warnings**",
  "",
  "Scope: repository HTML, sitemap mappings, titles, descriptions, H1s, canonicals and robots directives. " +
  "Warnings are opportunities to review, not proof of ranking problems. " +
  "Search performance, Google indexing and completed trial conversions need real GSC/GA4 data.",
  "",
  "## Critical issues", "",
  ...(errors.length ? errors.map(x => "- " + x) : ["No critical issues found."]),
  "", "## Review list", "",
  ...(warnings.length ? warnings.map(x => "- " + x) : ["No review items found."]),
  ""
];
const report = lines.join("\n");
writeFileSync(join(root, "seo-audit-report.md"), report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
console.log(report.slice(0, 16000));
if (errors.length) process.exitCode = 1;
