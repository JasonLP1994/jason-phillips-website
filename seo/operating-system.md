# Phillips English — SEO operating system
Updated: 28 October 2026
Owner: Phillips English
Primary business outcome: qualified trial bookings, not article volume or vanity SEO scores.

## Stable foundations (no temporary trial required)
1. Google Search Console: source of truth for impressions, clicks, indexed pages, queries, locations and landing pages. Property: phillipsenglish.com. Check access inside Google's own dashboard; do not treat third-party estimates as actual clicks.
2. Google Analytics 4: measure organic sessions and completed trial bookings. The event `trial_booking_intent` is **not** a booking. The confirmation events are `trial_booking_complete` and `generate_lead`; an accepted Cal.com booking and a real GA4 event/key-event receipt must both be verified. GA4 property/account noted previously: 555715265; check GA4 itself before considering verification complete.
3. GitHub Actions: existing `.github/workflows/content-audit.yml` now runs technical validation weekly on Monday 08:15 UTC, on relevant code changes, or manually. Its report artifact is `phillips-english-technical-seo`. `scripts/seo-audit.mjs` verifies sitemap-linked content metadata; `scripts/check_links.py` checks local links and redirects. No auto-publishing or automatic SEO rewriting.
4. Existing public GitHub and Vercel deployment: canonical host is https://www.phillipsenglish.com/; preserve current domains, pricing, copy, navigation, booking and portal security.
5. Ubersuggest Free: only for occasional keyword research. Current plan allows just one project and three reports per day; the single project is used by Phillips Digital, not Phillips English. Do not delete or replace its project without approval.
6. Windsor.ai: connected Search Console and GA4 accounts exist, but free-plan overage has previously returned explicitly **synthetic placeholder rows**, not traffic or conversion truth. Never present its placeholder zeros as measured performance.

## Conversion-first search priorities
- Core English business/lesson pages: /business-english-coaching.html, /coaching.html, /interview-presentation-english.html, /pronunciation-fluency-coaching.html and /free-trial.html.
- Italy market: /it, /it/business-english, /it/colloqui-presentazioni and /it/prova-gratuita. Use native Italian page copy and local search intent; avoid translated keyword stuffing.
- Useful support content: /business-english-meeting-phrase-cheat-sheet.html and /english-job-interview-questions-answers.html. Link resources naturally to the relevant service page and trial route.
- Check buyer-intent search phrases in Google Search Console first. Research examples: "business English tutor online", "private British English lessons", "corso di business english online", "colloquio di lavoro in inglese", and professional interview preparation. These are hypotheses, not verified new ranking opportunities.

## Weekly Monday 30-minute cadence
1. Run or read technical SEO GitHub Actions report; fix confirmed errors first, review warnings in context.
2. Open Google Search Console (last 28 days vs prior 28 days); review clicks, impressions, CTR, impressions for service pages and countries including Italy. Keep screenshots or export snapshots if not accessible through connected integrations.
3. Open GA4 (same date range); review verified organic enquiries and accepted booking completions. Reject ordinary button-click events as conversion substitutes.
4. Choose one real issue or one buyer-intent content improvement. Keep a simple change log: URL, problem, evidence, action, release SHA, follow-up date.
5. Check results four weeks later. SEO outcomes can take longer; avoid promising rankings.

## Monthly decisions
- Priority 1: number of genuine qualified English enquiries and accepted trials from organic search.
- Priority 2: impressions and clicks to high-intent landing pages, separated by UK and Italy when there is enough data.
- Priority 3: indexing, crawl errors and referring domains earned through editorial relevance (not link-exchange networks).
- Publish quality over quantity. No mass AI publishing, automated forum spam, paid backlinks or unsolicited messages.
- Do not start Google Search Ads until actual booking conversion tracking is verified and the owner authorises the spend.

## Still requires authenticated Google/browser access
- Confirm ownership and indexing coverage in direct Search Console, including both host variants.
- Verify a successful Cal.com embed booking payload actually produces an observed GA4 booking-completion event and that the intended event is marked as a key event.
- Build Looker Studio dashboards using direct GSC and GA4 connectors; no connected Looker Studio authoring or read access has been established from this chat.
- If desired, connect Ahrefs Webmaster Tools / Ahrefs Free to verified website properties; registration and ownership confirmation require the account owner's consent and access. Do not assume an Ahrefs paid API integration is included in the free tier.

## Separate business
Phillips Digital has its own Ubersuggest project, Search Console property, goals and technical SEO backlog; never combine either site's analytics or publish English-learning content to the digital studio site.

## What this report can and cannot do
The GitHub audit detects repository metadata and local links, not live Google indexing, backlinks, bot access, actual ranking or conversions. A successful GitHub workflow is technical monitoring, **not** evidence that lead generation works.