# SEO guide for Stroop

What search engine optimisation (SEO) is, what this site already does, and what to do next. Written for this project; the ideas apply to any site.

---

## 1. How search works, in three steps

Every search engine does the same three things. SEO means making each step easy.

| Step | What happens | What can go wrong |
| --- | --- | --- |
| **Crawl** | A bot (Googlebot) downloads your pages and follows links between them. | Pages blocked by robots.txt, broken links, pages nothing links to, or a firewall turning the bot away. |
| **Index** | Google reads each page and decides whether to store it, and as which address. | Duplicate copies of a page, pages marked `noindex`, very thin pages. |
| **Rank** | For each search, Google orders the stored pages by how well they answer it and how much it trusts them. | Not using the words people search for, too little useful content, no other sites linking to you. |

Rough weight, for a small site like this one:
- **Technical** (crawl and index): has to be right, but once it is, it stops mattering. Yours is done.
- **On-page** (content and wording): what each page says and how well it answers the search.
- **Off-page** (links and mentions from other sites): usually the biggest factor in ranking, and the one only you can do.

---

## 2. Technical SEO: what's in place

| Item | What it does | Where |
| --- | --- | --- |
| `robots.txt` | Tells bots what they may crawl and where the sitemap is. Only `/auth/` is blocked. | `src/app/robots.ts` → `/robots.txt` |
| `sitemap.xml` | Lists every page with its last-changed date, so Google finds pages without guessing. | `src/app/sitemap.ts` |
| Canonical URL | Each page names its one true address, so `/how-to-play/`, `/how-to-play.html` and the pages.dev copy all count as the same page. | `alternates.canonical` in each page |
| pages.dev copy hidden | `stroop-test.pages.dev` serves the same site; it now tells bots not to index it. | `public/_headers` |
| Redirects | `http://` → `https://`, trailing slash and `.html` → clean address. Done by Cloudflare. | Cloudflare Pages |
| 404 page | Missing pages return a real 404 status, are kept out of search, and link back into the site. | `src/app/not-found.tsx` |
| Caching | Build files are cached for a year, because their names change when their content changes. Faster repeat visits. | `public/_headers` |
| HTTPS only | Browsers are told to always use HTTPS. | `public/_headers` |
| One `h1` per page | The main heading tells Google what the page is about. | each page |
| `lang="en"` | Declares the language. | `src/app/layout.tsx` |

**Keeping it right:**
- **New page:** add it to `src/app/sitemap.ts` and give it `pageMetadata(...)`, which sets its title, description, canonical and preview tags.
- **Changed text:** update its date in `PAGE_UPDATED` in `src/lib/site.ts`. The sitemap and the policy pages read it from there.

---

## 3. On-page SEO: words that match searches

### Search intent
Every search has a purpose. Your page has to match it:
- **"stroop test online"**, **"stroop effect game"**: the person wants to *do* the test. The home page answers this: the game is right there.
- **"what is the stroop effect"**, **"why is the stroop test hard"**: the person wants to *learn*. `/how-to-play` answers this.

A page that matches the purpose ranks better than one that only repeats the words.

### Title and description
These are what people see in the results, so they decide whether anyone clicks.

| | Rule of thumb | Home page now |
| --- | --- | --- |
| Title | Under ~60 characters, main words near the start, unique per page | `Stroop · Horror Stroop Effect Test, Play Free Online` |
| Description | Under ~160 characters, says what you get, makes people want to click | `Name the ink, not the word. A free online Stroop effect test turned horror game…` |

Google sometimes rewrites these. A clear, honest one is rewritten less.

### Content
- **Visible text matters most.** Google reads what's on the page, and a game screen has little text. That's why:
  - the home page now has the line "A free Stroop effect test, played as a horror game"
  - `/how-to-play` explains the effect, the rules, the modes and common questions
- **Write for people.** Repeating keywords ("keyword stuffing") gets pages ranked lower, not higher.
- **Answer the questions people actually ask.** That's what the FAQ on `/how-to-play` is for. Search Console will show you which questions people search for, and you can add answers to them over time.

### Internal links
Links between your own pages help Google find them and understand what they're about. The anchor text ("how to play") describes the page it points to. Every page here links to the others through the menu and page footers.

---

## 4. Structured data (schema)

This is hidden JSON-LD that describes the page in a fixed vocabulary (schema.org), so search engines don't have to guess.

| Page | Types | Why |
| --- | --- | --- |
| Home | `WebSite`, `VideoGame` | The site's name (shown above results), and that it's a free browser game |
| How to play | `WebPage` with breadcrumb, `FAQPage` | Shows *Stroop › How to play* instead of a raw URL; questions and answers machines can quote |
| Privacy, Terms | `BreadcrumbList` | Same breadcrumb trail |

**Rules:**
- **Describe only what the page shows.** The FAQ data repeats the visible FAQ word for word. Never put anything in structured data that isn't on the page; Google can penalise that.
- **Expect little for FAQ in Google.** Since 2023 Google shows FAQ results mainly for government and health sites. Bing and AI assistants still read the markup, and the visible FAQ helps either way.
- **Test changes** with Google's [Rich Results Test](https://search.google.com/test/rich-results): paste a page address and fix any errors it lists.

---

## 5. Speed and mobile (Core Web Vitals)

Google measures real visitors' experience in Chrome:

| Metric | Measures | Good |
| --- | --- | --- |
| **LCP**: Largest Contentful Paint | How fast the main content appears | under 2.5 s |
| **INP**: Interaction to Next Paint | How fast the page reacts to a tap or click | under 200 ms |
| **CLS**: Cumulative Layout Shift | How much things jump around while loading | under 0.1 |

**How this site does:**
- **Fast to appear:** pages are pre-built HTML on Cloudflare's network, so content shows before any JavaScript runs.
- **Heaviest part:** about 250 KB of compressed JavaScript, mostly the sign-in library (Supabase). It's fine on modern phones; on slow ones it could delay the first tap. If PageSpeed flags it, the fix is to load that library only when someone opens sign-in or the leaderboard.

**Check it:** open [PageSpeed Insights](https://pagespeed.web.dev/), enter `https://stroop.lianhonglim.my`, and look at the **Mobile** tab. Lab scores show straight away. Real-visitor data appears once the site has enough traffic.

---

## 6. Off-page SEO: links and mentions

A link from another site to yours works like a vote of trust. A new site with no links rarely ranks for competitive words, however good it is.

**Good links for this game:**
1. **Your own places:**
   - `lianhonglim.my` (a projects page)
   - the GitHub repo's *Website* field
   - your social profiles
2. **Game sites:** an itch.io page for the game (choose *HTML / played in browser*) that links back to the site.
3. **Communities:**
   - Reddit: r/WebGames, r/playmygame, r/HorrorGaming (read each one's rules first)
   - Hacker News: a "Show HN" post
4. **Teachers and students:** the Stroop test is a classic classroom demo, and psychology teaching forums, blogs and university course pages link to good demos for years.
5. **Gaming press and bloggers:** small indie or horror game blogs often take tips by email.

**Avoid:** buying links, link exchanges and "SEO packages". Google detects them, and they can get a site pushed down.

---

## 7. AI search (ChatGPT, Claude, Perplexity, Google AI Overviews)

More people now ask AI assistants instead of searching. They learn from the same web, plus a few extras:
- **`/llms.txt`:** a short plain-text summary of the site with its key facts, for AI tools that look for one. It's a new convention, not a standard; it's cheap to keep. Update it when the modes or rules change: `public/llms.txt`.
- **Crawler access:** `robots.txt` allows every bot, including AI ones. Cloudflare has its own switch that can block AI crawlers. Check **Cloudflare dashboard → your domain → Security → Bots** (or **AI Crawl Control**) and make sure AI crawlers aren't blocked, if you want to appear in AI answers.
- **Clear, factual text:** AIs quote pages that state things plainly ("Easy has 3 colours, 10 words, 6 seconds each"). `/how-to-play` is written that way.
- **Mentions elsewhere:** Reddit threads and "best browser games" lists strongly shape what AIs recommend. The links in section 6 help here too.

---

## 8. Measuring: Google Search Console

| Report | What it tells you | When to look |
| --- | --- | --- |
| **Performance** | Searches you appeared for (*queries*), how often (*impressions*), clicks, and average position | Every 2 weeks |
| **Indexing → Pages** | Which pages are indexed, and why others aren't | After adding pages |
| **Sitemaps** | Whether Google can read the sitemap (yours: *Success*, 4 pages) | After changing pages |
| **URL Inspection** | One page's status; **Request indexing** after a big change | When needed |
| **Experience → Core Web Vitals** | Real-visitor speed, once there's enough traffic | Monthly |

**Turning Performance data into improvements:**
- **Many impressions but few clicks:** people see you but don't choose you. Rewrite that page's title or description.
- **Position 8–20 for a query:** you're close. Add a section that answers that query better, and get a link or two to that page.
- **A question you've never covered:** add it to the FAQ on `/how-to-play`.

Also add the site to **Bing Webmaster Tools** and choose *Import from Google Search Console*. It takes about two minutes, and Bing also powers DuckDuckGo, Yahoo and some AI search.

---

## 9. Timeline

| When | Expect |
| --- | --- |
| Days 1–7 | Pages indexed. Searching `site:stroop.lianhonglim.my` in Google lists them. |
| Weeks 2–6 | Searching the name "Stroop game" and very specific phrases may start to show you. |
| Months 2–6 | With some links from other sites, broader searches like "stroop effect game" and "stroop test online". |
| Ongoing | Broad terms like "stroop test" are held by universities and big psychology sites. Ranking there needs strong links, and may not happen. Specific phrases are where a small site wins. |

---

## 10. Checklist

**Once:**
- [ ] Request indexing for `/` and `/how-to-play` in Search Console
- [ ] Add the site to Bing Webmaster Tools (import from Search Console)
- [ ] Check Cloudflare isn't blocking AI crawlers, if you want AI visibility
- [ ] Run PageSpeed Insights on mobile
- [ ] Link to the game from your own site and the GitHub repo
- [ ] Post it in 2–3 relevant communities and on itch.io

**Every couple of weeks:**
- [ ] Search Console → Performance: new queries, low click rates, positions 8–20
- [ ] Improve one page based on what you saw

**Whenever you change the site:**
- [ ] New page: add it to `sitemap.ts`, use `pageMetadata(...)`, link to it from an existing page
- [ ] Changed text: update `PAGE_UPDATED` in `src/lib/site.ts`
- [ ] Changed rules or modes: update `public/llms.txt` and the FAQ
