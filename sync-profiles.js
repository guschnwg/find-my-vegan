#!/usr/bin/env node
/**
 * sync-profiles.js
 *
 * Reads data.json, picks N random profiles, and renders them as static
 * card HTML directly inside <div id="cards-grid"> in index.html.
 *
 * Usage:
 *   node sync-profiles.js [count]
 *
 * Default count: 50
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const HTML_FILE = path.join(ROOT, 'index.html');
const DEFAULT_COUNT = 50;

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

function main() {
    const count = parseInt(process.argv[2], 10) || DEFAULT_COUNT;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data)) {
        console.error('data.json must be an array');
        process.exit(1);
    }

    const effectiveCount = Math.min(count, data.length);
    let html = fs.readFileSync(HTML_FILE, 'utf8');

    const pool = buildPool(data, effectiveCount);

    const startRe = /<div id="cards-grid" class="cards-grid">/;
    const startMatch = html.match(startRe);
    if (!startMatch) {
        console.error('Could not locate #cards-grid in index.html');
        process.exit(1);
    }
    const startIdx = startMatch.index + startMatch[0].length;

    // Find the matching closing </div> for #cards-grid by tracking depth.
    let depth = 1;
    let i = startIdx;
    while (i < html.length && depth > 0) {
        const open = html.indexOf('<div', i);
        const close = html.indexOf('</div>', i);
        if (close === -1) break;
        if (open !== -1 && open < close) {
            depth++;
            i = open + 4;
        } else {
            depth--;
            i = close + 6;
        }
    }
    const endIdx = i - 6;

    html = html.slice(0, startIdx) + '\n' + pool + '\n        ' + html.slice(endIdx);

    // Also clear any previous <template id="profile-pool"> block, if present.
    const tplRe = /\n?\s*<template id="profile-pool">[\s\S]*?<\/template>\n?/;
    if (tplRe.test(html)) {
        html = html.replace(tplRe, '\n');
    }

    fs.writeFileSync(HTML_FILE, html);
    console.log(`Synced ${effectiveCount} random profiles into #cards-grid.`);
}

main();