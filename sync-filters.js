#!/usr/bin/env node
/**
 * sync-filters.js
 *
 * Reads data.json and regenerates the static filter pills
 * (category-list and language-list) inside index.html.
 *
 * Usage:
 *   node sync-filters.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const HTML_FILE = path.join(ROOT, 'index.html');

const LANG_ICONS = {
    'pt-BR': '🇧🇷',
    'en-US': '🇺🇸',
    'en-GB': '🇬🇧',
    'en-CA': '🇨🇦',
    'en-IE': '🇮🇪',
    'en-AU': '🇦🇺',
};

function buildCategoryList(items) {
    const counts = new Map();
    for (const it of items) {
        for (const c of it.categories || []) {
            counts.set(c, (counts.get(c) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) =>
            `                    <button class="cat-pill" data-cat="${name}">${name} <span class="cat-count">${count}</span></button>`
        )
        .join('\n');
}

function buildLanguageList(items) {
    const counts = new Map();
    for (const it of items) {
        if (it.language) {
            counts.set(it.language, (counts.get(it.language) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code, count]) => {
            const icon = LANG_ICONS[code] || code;
            return `                    <button class="cat-pill lang-pill" data-lang="${code}">${icon} <span class="cat-count">${count}</span></button>`;
        })
        .join('\n');
}

function findMatchingDivEnd(html, startIdx) {
    let depth = 1;
    let i = startIdx;
    while (i < html.length && depth > 0) {
        const open = html.indexOf('<div', i);
        const close = html.indexOf('</div>', i);
        if (close === -1) return -1;
        if (open !== -1 && open < close) { depth++; i = open + 4; }
        else { depth--; i = close + 6; }
    }
    return i - 6;
}

function replaceContainer(html, openTag, newContent) {
    const openIdx = html.indexOf(openTag);
    if (openIdx === -1) throw new Error(`Could not locate ${openTag}`);
    const startIdx = openIdx + openTag.length;
    const endIdx = findMatchingDivEnd(html, startIdx);
    if (endIdx === -1) throw new Error(`Could not find matching </div> for ${openTag}`);
    return html.slice(0, startIdx) + '\n' + newContent + '\n        ' + html.slice(endIdx);
}

function main() {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data)) {
        console.error('data.json must be an array');
        process.exit(1);
    }

    let html = fs.readFileSync(HTML_FILE, 'utf8');

    const newCats = buildCategoryList(data);
    const newLangs = buildLanguageList(data);

    html = replaceContainer(html, '<div id="category-list" class="category-list">', newCats);
    html = replaceContainer(html, '<div id="language-list" class="category-list">', newLangs);

    fs.writeFileSync(HTML_FILE, html);
    console.log(`Synced filters from ${data.length} entries.`);
}

main();