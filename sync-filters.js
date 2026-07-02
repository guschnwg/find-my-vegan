#!/usr/bin/env node
/**
 * sync-filters.js
 *
 * Reads data.json and regenerates the static filter pills
 * (category-list and language-list) inside index.html.
 *
 * Pills are written into the region delimited by
 *   <!-- BEGIN CATEGORY_PILLS --> ... <!-- END CATEGORY_PILLS -->
 * and
 *   <!-- BEGIN LANGUAGE_PILLS --> ... <!-- END LANGUAGE_PILLS -->
 * inside their respective <div class="cat-pills-wrap"> wrappers.
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
            `                            <button class="cat-pill is-hidden" data-cat="${name}">${name} <span class="cat-count">${count}</span></button>`
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
            return `                            <button class="cat-pill lang-pill is-hidden" data-lang="${code}">${icon} <span class="cat-count">${count}</span></button>`;
        })
        .join('\n');
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
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data)) {
        console.error('data.json must be an array');
        process.exit(1);
    }

    let html = fs.readFileSync(HTML_FILE, 'utf8');

    const newCats = buildCategoryList(data);
    const newLangs = buildLanguageList(data);

    html = replaceMarker(html, 'CATEGORY_PILLS', 'CATEGORY_PILLS', '\n' + newCats + '\n                        ');
    html = replaceMarker(html, 'LANGUAGE_PILLS', 'LANGUAGE_PILLS', '\n' + newLangs + '\n                        ');

    fs.writeFileSync(HTML_FILE, html);
    console.log(`Synced filters from ${data.length} entries.`);
}

main();