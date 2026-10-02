# Adding a blog post

The blog is plain static HTML like the rest of the site — no build step. A post is
one HTML file plus four small edits elsewhere. Work on a branch, never directly on `main`.

Throughout, `<slug>` is the post's URL slug (lowercase, hyphens), e.g. `ai-cost-per-customer`.
The public URL is always `https://tolvyn.io/blog/<slug>` — no `.html`, no trailing slash.

**URL rule for the whole site:** every canonical, `og:url`, JSON-LD URL, sitemap entry and
internal link uses the page's *final* URL under Cloudflare Pages — the one that returns 200 with
no redirect. Pages strips `.html` (308), so:

| File | Final URL |
|---|---|
| `blog/<slug>.html` | `https://tolvyn.io/blog/<slug>` |
| `blog/index.html` | `https://tolvyn.io/blog/` (trailing slash — `/blog` 308s to it) |
| `pages/pricing.html` | `https://tolvyn.io/pages/pricing` |
| `index.html` | `https://tolvyn.io/` |

Never link to `….html`, to `/blog` without the slash, or to a `_redirects` alias such as `/pricing`.

## 1. Create the page

```bash
cp blog/ai-cost-per-customer.html blog/<slug>.html
```

In `blog/<slug>.html`, change **every** occurrence of the old post's values:

**`<head>`**
- [ ] `<title>` — `<Post title> — TOLVYN`
- [ ] `<meta name="description">` — the post's one-line description (also used on the card and in RSS)
- [ ] `<meta name="author">`
- [ ] `og:url`, `og:title`, `og:description`, `article:published_time`, `article:author`
- [ ] `twitter:title`, `twitter:description`
- [ ] `<link rel="canonical" href="https://tolvyn.io/blog/<slug>">` — extensionless
- [ ] Keep `og:image` / `twitter:image` as the default `https://tolvyn.io/assets/brand/og-image.png` unless a new image exists
- [ ] Keep the RSS `<link rel="alternate">` line and the Content-Security-Policy meta unchanged

**JSON-LD (two `<script type="application/ld+json">` blocks in `<head>`)**
- [ ] BlogPosting: `headline`, `description`, `datePublished`, `dateModified`, `author`, `mainEntityOfPage.@id`, `url`
- [ ] BreadcrumbList: position 3 `name` (post title) and `item` (`https://tolvyn.io/blog/<slug>`)

**Body**
- [ ] Breadcrumb: the third item (`aria-current="page"`) = post title
- [ ] `<h1>` = post title. Exactly **one** `<h1>` on the page; sections are `<h2>`, sub-sections `<h3>`
- [ ] Date line: `<time datetime="YYYY-MM-DD">D Mon YYYY</time> · N min read · Author`
- [ ] Replace the article text inside `<article class="docs-main post-body">`. Inline code: `<code class="mono">…</code>`. External links: `target="_blank" rel="noopener noreferrer"`
- [ ] End of page: keep the CTA box; point the "Related:" link at the most relevant use-case or product page, using its final URL (e.g. `/use-cases/cost-attribution-per-customer`, not `….html`)

Reading time = words ÷ 230, rounded. To count words in the article:

```bash
python3 -c "import re,html,sys;h=open(sys.argv[1]).read();a=h[h.index('<article'):h.index('</article>')];print(len(html.unescape(re.sub(r'<[^>]+>',' ',a)).split()))" blog/<slug>.html
```

## 2. Add a card to /blog

In `blog/index.html`, copy one `<li class="post-list__item">` block to the **top** of the list
(newest first) and change: date (`datetime` and display), reading time, title, description,
and the link (twice — title and "Read the post", plus the `aria-label`).

Also add the post to the `blogPost` array in the Blog JSON-LD in the same file (newest first).

## 3. Add it to the RSS feed

In `blog/rss.xml`, copy one `<item>` to the **top** (newest first) and change `title`, `link`,
`guid`, `pubDate` (RFC 822, e.g. `Mon, 12 Oct 2026 00:00:00 +0530` — check the weekday),
`dc:creator`, `description`. Update the channel `<lastBuildDate>` to the new post's date.

## 4. Routing and sitemap

- [ ] **Do NOT add anything to `_redirects`.** Cloudflare Pages already serves `blog/<slug>.html`
  at `/blog/<slug>` and 308-redirects `/blog/<slug>.html` to it. A `200` rewrite to the `.html`
  file loops against that redirect (ERR_TOO_MANY_REDIRECTS).
- [ ] `sitemap.xml` — add `<url><loc>https://tolvyn.io/blog/<slug></loc><priority>0.8</priority><lastmod>YYYY-MM-DD</lastmod></url>`
  and update the `lastmod` of `https://tolvyn.io/blog/` to the same date. Sitemap entries are final URLs only.

## 5. Internal links

- [ ] Link **to** the new post (`/blog/<slug>`) from 1–2 relevant existing pages (a single "Further reading:" line at the end, like `use-cases/cost-attribution-per-customer.html`). Don't reword those pages.
- [ ] Link **from** the post to the relevant product/use-case page (the "Related:" line).

## 6. Check before merging

```bash
# validate RSS + sitemap XML and every JSON-LD block
python3 -c "import xml.dom.minidom as m; m.parse('blog/rss.xml'); m.parse('sitemap.xml'); print('xml ok')"
python3 -c "import re,json,glob
for f in glob.glob('blog/*.html'):
    for b in re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', open(f).read(), re.S): json.loads(b)
print('json-ld ok')"
# preview locally with Pages' real routing, then open /blog/ and /blog/<slug>
# at phone width (390px) and desktop. Stop it with Ctrl+C; delete the .wrangler/ folder it creates.
npx wrangler pages dev . --port 8788
curl -sIL http://127.0.0.1:8788/blog/<slug>        # must end in 200
curl -sIL http://127.0.0.1:8788/blog/<slug>.html   # must 308 to /blog/<slug>, then 200
curl -sI  http://127.0.0.1:8788/blog/               # 200, no redirect
# every canonical and sitemap URL must answer 200 with ZERO redirects:
for u in $(grep -o '<loc>[^<]*' sitemap.xml | sed 's|<loc>https://tolvyn.io||'); do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:8788$u)" "$u"; done
```

- [ ] Exactly one `<h1>` per page; no horizontal scroll at 390px
- [ ] Every claim about TOLVYN checked against the code before publishing

## 7. Publish (Cloudflare Pages, Direct Upload — a git push does NOT deploy)

```bash
git switch main && git merge <branch> && git push origin main
rm -rf /tmp/tolvyn-site && mkdir /tmp/tolvyn-site
git archive origin/main | tar -x -C /tmp/tolvyn-site
npx wrangler pages project list                      # find <PROJECT_NAME>
npx wrangler pages deploy /tmp/tolvyn-site --project-name=<PROJECT_NAME> --branch=main
```

`--branch=main` is required: without it wrangler may use the checked-out git branch name and
create a preview deployment instead of updating production. Alternatively upload `/tmp/tolvyn-site`
in the Cloudflare dashboard (Workers & Pages → project → Create deployment).

After deploying: open `https://tolvyn.io/blog/<slug>`, check it in the RSS feed, and submit the
URL in Google Search Console (URL inspection → Request indexing).
