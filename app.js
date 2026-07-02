$(function () {
    const PLANT_EMOJIS = ['🌱', '🌿', '🍀', '🌵', '🌴', '🌳', '🌲', '☘️', '🪴', '🍃', '🌾', '🪷'];
    const PER_PAGE = 30;

    const state = {
        items: [],
        filtered: [],
        page: 1,
        activeCategories: new Set(),
        activeLanguages: new Set()
    };

    const LANG_ICONS = {
        'pt-BR': '🇧🇷',
        'en-US': '🇺🇸',
        'en-GB': '🇬🇧',
        'en-CA': '🇨🇦',
        'en-IE': '🇮🇪',
        'en-AU': '🇦🇺'
    };

    function languageLabel(code) {
        return LANG_ICONS[code] || code;
    }

    // Random plant emoji for each card
    function plantEmoji() {
        return PLANT_EMOJIS[Math.floor(Math.random() * PLANT_EMOJIS.length)];
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function instagramEmbedUrl(url) {
        // Convert any instagram URL (profile or post) to embed
        return url.replace(/\/$/, '') + '/embed/';
    }

    function renderCard(item, idx) {
        const chips = (item.categories || [])
            .map(c => `<span class="chip">${escapeHtml(c)}</span>`)
            .join('');

        const verified = '';

        const embedSrc = instagramEmbedUrl(item.url);

        const langChip = item.language
            ? `<span class="chip chip-lang" data-lang="${escapeHtml(item.language)}" title="${escapeHtml(item.language)}">${escapeHtml(languageLabel(item.language))}</span>`
            : '';

        return `
            <article class="card" style="animation-delay:${(idx % PER_PAGE) * 0.04}s">
                <div class="card-embed">
                    <blockquote class="instagram-media"
                        data-instgrm-permalink="${escapeHtml(item.url)}"
                        data-instgrm-version="14"
                        style="background:#FFF; border:0; border-radius:0; margin:0; max-width:540px; min-width:280px; padding:0; width:100%;">
                    </blockquote>
                </div>

                <div class="card-info">
                    <div class="card-name">
                        ${escapeHtml(item.name)} ${verified} ${langChip}
                    </div>
                    <div class="card-description">${escapeHtml(item.description)}</div>
                    <div class="card-info-bottom">
                        <div class="card-chips">${chips}</div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderGrid() {
        const $grid = $('#cards-grid');
        $grid.addClass('fade-out');

        setTimeout(() => {
            const start = (state.page - 1) * PER_PAGE;
            const slice = state.filtered.slice(start, start + PER_PAGE);

            if (slice.length === 0) {
                $grid.html(`
                    <div class="empty-state">
                        <span class="emoji">🌵</span>
                        <p>No profiles match your search.</p>
                    </div>
                `);
            } else {
                $grid.html(slice.map(renderCard).join(''));
                processInstgrmEmbeds();
            }

            $grid.removeClass('fade-out').addClass('fade-in');

            setTimeout(() => $grid.removeClass('fade-in'), 400);
        }, 220);
    }

    function processInstgrmEmbeds() {
        if (window.instgrm && window.instgrm.Embeds && window.instgrm.Embeds.process) {
            window.instgrm.Embeds.process();
        }
        // Hide fallbacks once IG has had a chance to hydrate
        setTimeout(() => {
            $('.card-embed-fallback').each(function () {
                const $fb = $(this);
                const $embed = $fb.siblings('blockquote.instagram-media');
                if ($embed.find('iframe').length > 0 || $embed.children().length > 1) {
                    $fb.remove();
                }
            });
        }, 600);
    }

    function renderPagination() {
        const total = Math.ceil(state.filtered.length / PER_PAGE);
        const $p = $('#pagination').empty();

        if (total <= 1) return;

        const mk = (label, page, opts = {}) => {
            const disabled = opts.disabled ? 'disabled' : '';
            const active = opts.active ? 'active' : '';
            return `<button class="page-btn ${active}" ${disabled} data-page="${page}">${label}</button>`;
        };

        $p.append(mk('«', state.page - 1, { disabled: state.page === 1 }));

        const pages = new Set([1, total, state.page - 1, state.page, state.page + 1]);
        const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

        let last = 0;
        sorted.forEach(p => {
            if (p - last > 1) $p.append('<span class="page-ellipsis">…</span>');
            $p.append(mk(p, p, { active: p === state.page }));
            last = p;
        });

        $p.append(mk('»', state.page + 1, { disabled: state.page === total }));
    }

    function applyFilter() {
        console.log('applyFilter')
        const q = $('#search').val().trim().toLowerCase();
        const cats = state.activeCategories;
        const langs = state.activeLanguages;
        let results = state.items.filter(it => {
            if (cats.size > 0) {
                const itemCats = it.categories || [];
                for (const c of cats) {
                    if (!itemCats.includes(c)) return false;
                }
            }
            if (langs.size > 0) {
                if (!langs.has(it.language)) return false;
            }
            if (q) {
                const hay = [
                    it.name, it.description, it.language, it.type,
                    ...(it.categories || [])
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        state.filtered = results;
        state.page = 1;
        renderGrid();
        renderPagination();
        renderCategoryList();
        renderLanguageList();
        $('#clear-filters').prop('hidden', cats.size === 0 && langs.size === 0 && !q);
    }

    function getListConfig(type) {
        if (type === 'categories') {
            return {
                listId: '#category-list',
                stateSet: state.activeCategories,
                pillAttr: 'cat'
            };
        }
        return {
            listId: '#language-list',
            stateSet: state.activeLanguages,
            pillAttr: 'lang'
        };
    }

    function updateVisibilityFor(type) {
        const cfg = getListConfig(type);
        const $list = $(cfg.listId);
        const expanded = $list.hasClass('is-expanded');
        const hasSelection = cfg.stateSet.size > 0;
        $list.find('.cat-pill').each(function () {
            const value = $(this).data(cfg.pillAttr);
            const isActive = cfg.stateSet.has(value);
            if (!hasSelection) {
                $(this).toggleClass('is-hidden', !expanded);
            } else if (expanded) {
                $(this).removeClass('is-hidden');
            } else {
                $(this).toggleClass('is-hidden', !isActive);
            }
        });
    }

    function renderList(type) {
        const cfg = getListConfig(type);
        const $list = $(cfg.listId);
        $list.find('.cat-pill').each(function () {
            const value = $(this).data(cfg.pillAttr);
            $(this).toggleClass('active', cfg.stateSet.has(value));
        });

        const anySelected = cfg.stateSet.size > 0;
        $list.toggleClass('has-selection', anySelected);
        const expanded = $list.hasClass('is-expanded');

        const label = $list.find('.cat-toggle').data('label') || type;
        $list.find('.cat-toggle').each(function () {
            const $t = $(this);
            $t.text((expanded ? '− ' : '+ ') + label);
            $t.attr('aria-expanded', expanded ? 'true' : 'false');
        });
    }

    function renderCategoryList() { renderList('categories'); }
    function renderLanguageList() { renderList('languages'); }
    function updateCategoryVisibility() { updateVisibilityFor('categories'); }
    function updateLanguageVisibility() { updateVisibilityFor('languages'); }

    $(document).on('click', '.cat-toggle', function () {
        const type = $(this).data('toggle-for');
        if (!type) return;
        const cfg = getListConfig(type);
        $(cfg.listId).toggleClass('is-expanded');
        updateVisibilityFor(type);
        renderList(type);
    });

    // Events
    $(document).on('click', '.page-btn', function () {
        const p = parseInt($(this).data('page'), 10);
        if (!isNaN(p) && p >= 1 && p !== state.page) {
            state.page = p;
            renderGrid();
            renderPagination();
            $('html, body').animate({ scrollTop: $('.site-header').offset().top }, 400);
        }
    });

    $(document).on('click', function (e) {
        spawnPlantParticles(e.pageX - 6, e.pageY - 6, 12);
    });

    function spawnPlantParticles(x, y, count) {
        for (let i = 0; i < count; i++) {
            const p = document.createElement('span');
            p.className = 'plant-particle';
            p.textContent = plantEmoji();
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
            const dist = 50 + Math.random() * 30;
            p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--dy', (Math.sin(angle) * dist - 20) + 'px');
            p.style.setProperty('--rot', (Math.random() * 360) + 'deg');
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1300);
        }
    }

    let searchTimer;
    $('#search').on('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilter, 180);
    });

    $(document).on('click', '.cat-pill:not(.lang-pill)', function () {
        const cat = $(this).data('cat');
        if (state.activeCategories.has(cat)) {
            state.activeCategories.delete(cat);
        } else {
            state.activeCategories.add(cat);
        }
        applyFilter();
        updateCategoryVisibility();
        updateLanguageVisibility();
    });

    $(document).on('click', '.chip:not(.chip-lang)', function () {
        const cat = $(this).text().trim();
        if (state.activeCategories.has(cat)) {
            state.activeCategories.delete(cat);
        } else {
            state.activeCategories.add(cat);
        }
        applyFilter();
        updateCategoryVisibility();
        updateLanguageVisibility();
    });

    $(document).on('click', '.chip-lang', function () {
        const lang = $(this).data('lang');
        if (!lang) return;
        if (state.activeLanguages.has(lang)) {
            state.activeLanguages.delete(lang);
        } else {
            state.activeLanguages.add(lang);
        }
        applyFilter();
        updateCategoryVisibility();
        updateLanguageVisibility();
    });

    $(document).on('click', '.lang-pill', function () {
        const lang = $(this).data('lang');
        if (state.activeLanguages.has(lang)) {
            state.activeLanguages.delete(lang);
        } else {
            state.activeLanguages.add(lang);
        }
        applyFilter();
        updateCategoryVisibility();
        updateLanguageVisibility();
    });

    $('#clear-filters').on('click', function () {
        state.activeCategories.clear();
        state.activeLanguages.clear();
        $('#search').val('');
        applyFilter();
        updateCategoryVisibility();
        updateLanguageVisibility();
    });

    // Boot
    $.getJSON('data.json')
        .done(data => {
            state.items = Array.isArray(data) ? data : [];
        })
        .fail(() => {
            state.items = $('#cards-grid [data-static-profile]').map(function () {
                const $card = $(this);
                const url = $card.find('blockquote.instagram-media').data('instgrm-permalink');
                const $name = $card.find('.card-name').clone();
                $name.find('.chip-lang').remove();
                const name = $name.text().trim();
                const $lang = $card.find('.chip-lang');
                const language = $lang.length ? $lang.data('lang') : undefined;
                const description = $card.find('.card-description').text().trim();
                const categories = $card.find('.card-chips .chip').map(function () {
                    return $(this).text().trim();
                }).get();
                return { name, description, language, url, categories };
            }).get();
            applyFilter();
        });
});