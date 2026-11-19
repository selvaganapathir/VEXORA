# QuickPlay Lab

A mobile-first collection of free browser mini games, rebuilt as a lightweight static site.

## Games
- Reaction time test
- Typing speed test (WPM + accuracy)
- Memory match
- Word scramble
- Number guessing game

## Stack
Semantic HTML, CSS and vanilla JavaScript. No framework, no runtime dependency, no external fonts, no images, no login and no server. Scores are saved locally in the visitor's browser.

## Deploy
GitHub Pages is deployed by GitHub Actions. The workflow copies the static website into `dist/` and publishes it. The project URL is https://selvaganapathir.github.io/VEXORA/.

## Analytics setup
Google Analytics is prepared but intentionally disabled until the owner supplies their own GA4 Measurement ID:
1. Create a Google Analytics 4 property and a Web data stream for `https://selvaganapathir.github.io`.
2. Copy the Measurement ID (format `G-XXXXXXXXXX`).
3. Edit `analytics-config.js` and set `window.QUICKPLAY_GA_ID = 'G-XXXXXXXXXX';`.
4. Commit the change and wait for Pages deployment.
5. In GA4, use Reports → Realtime to verify visits. Standard reports may take 24–48 hours to populate.
Events include `tool_page_view`, `game_start`, `game_complete`, and `typing_started`. No names, emails or typed passage contents are sent to analytics.

## SEO
Every game has a distinct crawlable URL, title, description, canonical URL and helpful explanatory text. `robots.txt` and `sitemap.xml` are included. Submit the sitemap in Google Search Console after deployment. Indexing and ranking are controlled by search engines and cannot be guaranteed.

## Portfolio
This project demonstrates responsive design, client-side game logic, accessibility basics, browser storage, event analytics integration, semantic SEO and static hosting.
