"""Validate local links, sitemap entries and explicit Vercel redirects."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://www.phillipsenglish.com/"
errors = []
config = json.loads((ROOT / "vercel.json").read_text())
rewrites = {rule["source"]: rule["destination"] for rule in config.get("rewrites", [])
            if ":" not in rule["source"]}

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for key in ("href", "src", "action"):
            if attrs.get(key):
                self.links.append((self.getpos()[0], attrs[key]))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")

pages = {}
for path in ROOT.rglob("*.html"):
    if any(part in (".git", "node_modules", "dist") for part in path.relative_to(ROOT).parts):
        continue
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    pages[path.relative_to(ROOT).as_posix()] = page

def check(value, source, line=0, fragments=True):
    url = urlsplit(urljoin(ORIGIN + source, value))
    if url.scheme not in ("http", "https") or url.hostname not in ("www.phillipsenglish.com", "phillipsenglish.com"):
        return
    target = unquote(rewrites.get(url.path, url.path)).lstrip("/") or "index.html"
    path = (ROOT / target).resolve()
    if path.is_dir():
        target = (Path(target) / "index.html").as_posix()
        path = (path / "index.html").resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        errors.append(f"{source}:{line}: missing target {value}")
    elif fragments and url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
        errors.append(f"{source}:{line}: missing fragment {value}")

for source, page in pages.items():
    for line, value in page.links:
        check(value, source, line)
    if getattr(page, "canonical", None):
        check(page.canonical, source)

for loc in ET.parse(ROOT / "sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
    check(loc.text or "", "sitemap.xml", fragments=False)

redirects = {rule["source"]: rule for rule in config["redirects"]
             if not rule.get("has") and not rule.get("missing")}
for source, rule in redirects.items():
    if source == rule["destination"] or rule["destination"] in redirects:
        errors.append(f"vercel.json: redirect loop or chain from {source}")
    if ":" not in urlsplit(rule["destination"]).path:
        check(rule["destination"], "vercel.json", fragments=False)
for target in ["blog.html"] + sorted(p for p in pages if p.startswith("blog/")):
    for source in ("/" + target[:-5], "/" + target[:-5] + "/", "/" + target + "/"):
        if redirects.get(source, {}).get("destination") != "/" + target:
            errors.append(f"vercel.json: missing canonical redirect for {source}")

index = {urlsplit(urljoin(ORIGIN + "blog.html", value)).path for _, value in pages["blog.html"].links}
for target in pages:
    if target.startswith("blog/") and "/" + target not in index:
        errors.append(f"blog.html: unlisted article {target}")

helpers = (ROOT / "assets/site-polish.js").read_text()
for value in re.findall(r"link\.href\s*=\s*['\"]([^'\"]+)['\"]", helpers):
    for source in pages:
        check(value, source, fragments=False)

if errors:
    raise SystemExit("\n".join(errors))
print(f"Validated {len(pages)} HTML pages, sitemap, shared stylesheet URL and {len(redirects)} redirects.")
