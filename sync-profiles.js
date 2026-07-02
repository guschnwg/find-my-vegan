#!/usr/bin/env node
/**
 * sync-profiles.js
 *
 * Reads data.json and:
 *   1. Picks N random profiles and renders them as static card HTML
 *      inside <!-- BEGIN CARDS_GRID --> ... <!-- END CARDS_GRID -->
 *      within <div id="cards-grid"> (default N=50).
 *   2. Renders a <noscript> listing of ALL profiles into
 *      <!-- BEGIN NOSCRIPT_LISTING --> ... <!-- END NOSCRIPT_LISTING -->
 *      so search engines and JS-disabled users can read every creator.
 *   3. Renders a schema.org ItemList JSON-LD block of every profile
 *      into <!-- BEGIN ITEMLIST_LDJSON --> ... <!-- END ITEMLIST_LDJSON -->
 *      in the <head>.
 *   4. Writes sitemap.xml with the home page entry.
 *
 * Usage:
 *   node sync-profiles.js [count]
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const HTML_FILE = path.join(ROOT, 'index.html');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const DEFAULT_COUNT = 50;

const SITE_URL = 'https://guschnwg.github.io/find-my-vegan/';

const LANG_LABELS = {
    'pt-BR': 'Portuguese (Brazil)',
    'en-US': 'English (United States)',
    'en-GB': 'English (United Kingdom)',
    'en-CA': 'English (Canada)',
    'en-IE': 'English (Ireland)',
    'en-AU': 'English (Australia)',
};

const LANG_ICONS = {
    'pt-BR': '🇧🇷',
    'en-US': '🇺🇸',
    'en-GB': '🇬🇧',
    'en-CA': '🇨🇦',
    'en-IE': '🇮🇪',
    'en-AU': '🇦🇺',
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function escapeXml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function languageLabel(code) {
    return LANG_ICONS[code] || code;
}

function shuffle(array, seed) {
    const a = array.slice();
    let s = seed >>> 0;
    const rand = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function renderCard(item, idx) {
    const chips = (item.categories || [])
        .map(c => `<span class="chip">${escapeHtml(c)}</span>`)
        .join('');

    const langChip = item.language
        ? `<span class="chip chip-lang" data-lang="${escapeHtml(item.language)}" title="${escapeHtml(item.language)}">${escapeHtml(languageLabel(item.language))}</span>`
        : '';

    return `
            <article class="card" data-static-profile style="animation-delay:${(idx % 30) * 0.04}s">
                <div class="card-embed">
                    <blockquote class="instagram-media"
                        data-instgrm-permalink="${escapeHtml(item.url)}"
                        data-instgrm-version="14"
                        style="background:#FFF; border:0; border-radius:0; margin:0; max-width:540px; min-width:280px; padding:0; width:100%;">
                    </blockquote>
                </div>
                <div class="card-info">
                    <div class="card-name">
                        ${escapeHtml(item.name)} ${langChip}
                    </div>
                    <div class="card-description">${escapeHtml(item.description)}</div>
                    <div class="card-info-bottom">
                        <div class="card-chips">${chips}</div>
                    </div>
                </div>
            </article>`;
}

function buildPool(items, count) {
    const picked = shuffle(items, Date.now()).slice(0, count);
    return picked.map(renderCard).join('\n');
}

function buildNoscriptListing(items) {
    const entries = items.map(it => {
        const lang = it.language ? LANG_LABELS[it.language] || it.language : '';
        const cats = (it.categories || []).join(', ');
        const bits = [
            `<a href="${escapeHtml(it.url)}" rel="noopener noreferrer" target="_blank"><strong>${escapeHtml(it.name)}</strong></a>`,
            it.description ? ` — ${escapeHtml(it.description)}` : '',
            lang ? ` <em>[${escapeHtml(lang)}]</em>` : '',
            cats ? ` <span>(${escapeHtml(cats)})</span>` : '',
        ].join('');
        return `<li>${bits}</li>`;
    }).join('\n                            ');

    return `            <h2>Vegan creators directory</h2>
            <p>A curated directory of ${items.length} vegan creators from around the world. The interactive card grid requires JavaScript; the full list is below.</p>
            <ul>
                            ${entries}
            </ul>`;
}

function buildItemListLdJson(items) {
    const list = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Vegan creators directory',
        description: 'A curated directory of vegan creators from around the world.',
        url: SITE_URL,
        numberOfItems: items.length,
        itemListElement: items.map((it, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: it.url,
            name: it.name,
        })),
    };
    const body = JSON.stringify(list, null, 2)
        .split('\n')
        .map(line => '    ' + line)
        .join('\n');
    return `    <script type="application/ld+json">
${body}
    </script>
`;
}

function buildSitemap(items) {
    const now = new Date().toISOString().slice(0, 10);
    const urls = [
        { loc: SITE_URL, lastmod: now, changefreq: 'weekly', priority: '1.0' },
    ];
    const body = urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function replaceMarker(html, beginMarker, endMarker, newContent) {
    const beginRe = new RegExp(`<!--\\s*BEGIN\\s+${beginMarker}\\s*-->`);
    const endRe = new RegExp(`<!--\\s*END\\s+${endMarker}\\s*-->`);
    const beginMatch = html.match(beginRe);
    const endMatch = html.match(endRe);
    if (!beginMatch || !endMatch) {
        throw new Error(`Marker not found in index.html: ${beginMarker} / ${endMarker}`);
    }
    if (beginMatch.index >= endMatch.index) {
        throw new Error(`BEGIN marker must come before END marker: ${beginMarker}`);
    }
    const before = html.slice(0, beginMatch.index + beginMatch[0].length);
    const after = html.slice(endMatch.index);
    const sep = (newContent.endsWith('\n') || newContent === '') ? '' : '\n';
    return before + '\n' + newContent + sep + after;
}

function main() {
    const count = parseInt(process.argv[2], 10) || DEFAULT_COUNT;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data)) {
        console.error('data.json must be an array');
        process.exit(1);
    }

    const effectiveCount = Math.min(count, data.length);
    let html = fs.readFileSync(HTML_FILE, 'utf8');

    // 1) Fill #cards-grid with a random subset of cards.
    const pool = buildPool(data, effectiveCount);
    html = replaceMarker(html, 'CARDS_GRID', 'CARDS_GRID', pool);

    // 2) Replace the ItemList JSON-LD block.
    html = replaceMarker(html, 'ITEMLIST_LDJSON', 'ITEMLIST_LDJSON', buildItemListLdJson(data));

    // 3) Inject <noscript> listing.
    const noscriptBlock = buildNoscriptListing(data);
    html = replaceMarker(html, 'NOSCRIPT_LISTING', 'NOSCRIPT_LISTING', noscriptBlock);

    // 4) Write sitemap.xml.
    fs.writeFileSync(SITEMAP_FILE, buildSitemap(data));
    console.log(`Wrote ${SITEMAP_FILE} (home page only).`);

    fs.writeFileSync(HTML_FILE, html);
    console.log(`Synced ${effectiveCount} random profiles + ${data.length} noscript entries into index.html.`);
}

main();