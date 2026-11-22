(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    if (hash.startsWith('filter=')) {
      var parts = hash.slice(7).split(':');
      if (parts[0] === 'category') state.category = decodeURIComponent(parts[1] || 'all');
      if (parts[0] === 'chain') state.chain = decodeURIComponent(parts[1] || 'all');
      return;
    }
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function renderHeader() {
    return el('div', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark' }),
        el('span', { class: 'brand-title', text: 'Token Radar' })
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot: ' + DATA.as_of }),
        el('span', { text: DATA.watchlist_size + ' Watchlist protocols' }),
        el('span', { text: 'Model: ' + DATA.model_version })
      )
    );
  }

  function renderLede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-Token Protocols Ranked by Implied Value' }),
        el('p', { text: 'The radar indexes pre-token protocols from DefiLlama, scoring their implied airdrop/token value based on TVL, 7-day momentum, and age with no token. Explore protocol profiles, reasoning factors, and verified step-by-step farm plans.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist Size' }), el('b', { text: String(DATA.watchlist_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Board Scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early Protocols' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live Token Set Aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function renderTopCards() {
    var top3 = DATA.rows.slice(0, 3);
    if (top3.length === 0) return null;
    return el('section', { class: 'top-cards-section' },
      el('div', { class: 'top-cards-header', text: 'Top 3 Implied Value Opportunities' }),
      el('div', { class: 'top-cards-grid' }, top3.map(function (r) {
        return el('div', {
          class: 'top-card',
          onclick: function () { openDetail(r.slug); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } },
          tabindex: '0'
        },
          el('div', { class: 'top-card-header' },
            el('span', { class: 'rank-badge', text: 'Rank #' + r.rank }),
            el('span', { class: 'badge cat', text: r.category || 'Other' })
          ),
          el('div', { class: 'top-card-title', text: r.name }),
          el('div', { class: 'top-card-metrics' },
            el('div', null, el('div', { class: 'metric-label', text: 'TVL' }), el('div', { class: 'metric-value', text: fmtUsd(r.tvl_usd) })),
            el('div', null, el('div', { class: 'metric-label', text: 'Implied Value' }), el('div', { class: 'metric-value', text: fmtUsd(r.implied_value_usd) }))
          )
        );
      }))
    );
  }

  function renderControls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var allChainsSet = new Set();
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { allChainsSet.add(c); }); });
    var chains = Array.from(allChainsSet).sort();

    var searchInput = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category, chain...', value: state.q, 'aria-label': 'Search board' });
    searchInput.addEventListener('input', function () { state.q = searchInput.value; writeHash(); render(); });

    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });

    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });

    var preBtn = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-Token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var liveBtn = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live Token', onclick: function () { state.tab = 'live'; render(); } });

    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), searchInput),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Status' }), el('div', { class: 'tabs' }, preBtn, liveBtn)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' protocols shown' : DATA.live.length + ' live protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function renderBoardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' },
        el('div', { class: 'empty' },
          el('h3', { text: 'No protocols match your filter criteria' }),
          el('p', { text: 'Try clearing your search query or selecting a different category or chain filter.' }),
          el('button', { class: 'button primary', type: 'button', text: 'Reset Filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
        )
      );
    }
    var maxVal = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var change = r.change_7d;
      var changeText = change === null ? 'n/a' : fmtPct(change);
      var changeClass = change === null ? '' : change >= 0 ? 'pos' : 'neg';
      var chainsBadges = (r.chains || []).slice(0, 3).map(function (c) { return el('span', { class: 'badge', text: c }); });

      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null,
          el('div', { class: 'name-cell' },
            el('b', { text: r.name }),
            el('div', { class: 'badges' },
              el('span', { class: 'badge cat', text: r.category || 'Other' }),
              chainsBadges
            )
          )
        ),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + changeClass, text: changeText }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null,
          el('div', { class: 'bar-wrap' },
            el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(4, Math.round((r.implied_value_usd / maxVal) * 100)) + '%' })),
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
          )
        ),
        el('td', null, el('span', { class: 'status-pill', text: 'No Token' }))
      );
      tbody.appendChild(tr);
    });

    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', style: 'padding: 12px 16px; text-align: left;', text: 'Ranked pre-token protocols. Click any row to inspect valuation factors and step-by-step farm guide.' }),
          el('thead', null,
            el('tr', null,
              sortHeader('implied', 'Rank'),
              sortHeader('name', 'Protocol'),
              sortHeader('tvl', 'TVL'),
              sortHeader('growth', '7d Change'),
              sortHeader('age', 'Age'),
              sortHeader('implied', 'Implied Value'),
              el('th', { scope: 'col', text: 'Token Status' })
            )
          ),
          tbody
        )
      )
    );
  }

  function renderLiveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var change = r.change_7d;
      var changeText = change === null ? 'n/a' : fmtPct(change);
      var changeClass = change === null ? '' : change >= 0 ? 'pos' : 'neg';
      var chainsBadges = (r.chains || []).slice(0, 3).map(function (c) { return el('span', { class: 'badge', text: c }); });

      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null,
          el('div', { class: 'name-cell' },
            el('b', { text: r.name }),
            el('div', { class: 'badges' },
              el('span', { class: 'badge cat', text: r.category || 'Other' }),
              chainsBadges
            )
          )
        ),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + changeClass, text: changeText }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status-pill live', text: 'Token Trades' }))
      ));
    });

    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', style: 'padding: 12px 16px; text-align: left;', text: 'Live token protocols set aside from ranking. Their market cap is a verified market fact.' }),
          el('thead', null,
            el('tr', null,
              el('th', { scope: 'col', text: 'Status' }),
              el('th', { scope: 'col', text: 'Protocol' }),
              el('th', { scope: 'col', text: 'TVL' }),
              el('th', { scope: 'col', text: '7d' }),
              el('th', { scope: 'col', text: 'Market Cap' }),
              el('th', { scope: 'col', text: 'Token' })
            )
          ),
          tbody
        )
      )
    );
  }

  function renderModelPanel() {
    var m = DATA.model;
    return el('section', { class: 'model-panel' },
      el('h2', { text: 'Valuation Methodology' }),
      el('p', { class: 'sub', text: 'Every pre-token protocol is scored using an objective mathematical function of its snapshot metrics. No names or outcomes are manually adjusted.' }),
      el('div', { class: 'formula' },
        'implied_value = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';

    var chainsList = (row.chains || []).join(', ') || 'Various';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'badge cat', text: 'Rank #' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', style: 'margin-top: 8px;', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + chainsList })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close drawer', text: 'ESC', onclick: function () { dialog.close(); } })
    ));

    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Valuation Factors & Model Calculation' }),
      el('div', { class: 'equation-grid' },
        el('div', { class: 'equation-row' }, el('span', { text: 'Total Value Locked (TVL)' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', { class: 'equation-row' }, el('span', { text: '7-Day TVL Change' }), el('b', { text: fmtPct(row.change_7d) })),
        el('div', { class: 'equation-row' }, el('span', { text: 'Protocol Age (No Token)' }), el('b', { text: fmtAge(row.age_days) })),
        el('div', { class: 'equation-row' }, el('span', { text: 'Growth Multiplier' }), el('b', { text: row.growth_multiplier.toFixed(4) })),
        el('div', { class: 'equation-row' }, el('span', { text: 'Maturity Multiplier' }), el('b', { text: row.maturity_multiplier.toFixed(4) })),
        el('div', { class: 'equation-row', style: 'border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;' }, el('span', { text: 'Implied Value' }), el('b', { style: 'color: var(--accent);', text: fmtUsd(row.implied_value_usd) }))
      )
    ));

    var steps = row.farm_steps || [];
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Step-by-Step Farm Plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var parts = s.split(' Cost: ');
        var action = parts[0] || s;
        var tail = parts[1] ? 'Cost: ' + parts[1] : '';
        return el('li', null,
          el('b', { text: action }),
          tail ? el('span', { class: 'cost', text: tail }) : null
        );
      }))
    ));

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(renderHeader());
    shell.appendChild(renderLede());
    if (state.tab === 'pre-token' && !state.q && state.category === 'all' && state.chain === 'all') {
      var topCards = renderTopCards();
      if (topCards) shell.appendChild(topCards);
    }
    shell.appendChild(renderControls());
    shell.appendChild(state.tab === 'pre-token' ? renderBoardTable() : renderLiveTable());
    if (state.tab === 'pre-token') shell.appendChild(renderModelPanel());
    app.appendChild(shell);

    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
