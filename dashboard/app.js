// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, the live-token peers the multiples were fitted on,
// and a model panel with the fitted numbers and the held-out checks. No network: every byte
// it shows is in data.js.
//
// The page recomputes a row's implied value from the snapshot figures it carries
// (impliedOf), so the page's code and the board's data are visibly the same arithmetic:
//   implied = TVL x multiple x size x growth x maturity
// The sandbox changes the growth weight and the maturity range and re-sorts the board live;
// board.json always keeps the fitted model (growth weight 0.5, maturity range 0.6).
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA) {
    app.textContent = 'No radar data: data.js did not load.';
    app.setAttribute('aria-busy', 'false');
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var state = {
    tab: params.get('tab') === 'live' || params.get('tab') === 'model' ? params.get('tab') : 'board',
    q: params.get('q') || '',
    category: params.get('category') || 'all',
    chain: params.get('chain') || 'all',
    watchlistOnly: params.get('watchlist') === '1',
    minTvl: params.get('mintvl') || '0',
    sort: 'implied',
    dir: -1,
    selected: params.get('slug') || null,
    growthWeight: 0.5,
    maturityRange: 0.6,
  };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
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
  function clampGrowth(c) {
    var g = c === null || c === undefined ? 0 : c;
    return Math.min(120, Math.max(-60, g));
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks
  // the number board.json carries, so the page's code and the board's data agree.
  function impliedOf(row, growthWeight, maturityRange) {
    var growthMult = 1 + (clampGrowth(row.change_7d) / 100) * growthWeight;
    var age = row.age_days === null || row.age_days === undefined ? 365 : row.age_days;
    var maturity = 0.55 + (Math.min(Math.max(age, 0), 1460) / 1460) * maturityRange;
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * row.size_multiplier * growthMult * maturity));
  }
  function sandboxActive() {
    return state.growthWeight !== 0.5 || state.maturityRange !== 0.6;
  }
  function shownImplied(row) {
    return sandboxActive() ? impliedOf(row, state.growthWeight, state.maturityRange) : row.implied_value_usd;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { seen[r.category || 'Unknown'] = true; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (state.category !== 'all' && (r.category || 'Unknown') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.watchlistOnly && !r.watchlist) return false;
      if (Number(state.minTvl) > 0 && r.tvl_usd < Number(state.minTvl)) return false;
      return true;
    });
    var dir = state.dir;
    rows.sort(function (a, b) {
      var d = 0;
      if (state.sort === 'implied') d = shownImplied(a) - shownImplied(b);
      else if (state.sort === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (state.sort === 'age') d = (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days);
      else if (state.sort === 'odds') d = a.odds_high_pct - b.odds_high_pct;
      else if (state.sort === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      if (d === 0) d = a.slug < b.slug ? -1 : 1;
      return d * dir;
    });
    return rows;
  }

  function renderHeader(wrap) {
    var hero = el('header', { class: 'hero' });
    hero.appendChild(el('h1', {}, 'Token Radar', el('span', { class: 'dot', text: ' — ' }), 'pre-token protocols, ranked by implied launch value'));
    hero.appendChild(el('p', {}, 'Which protocol with no token yet is worth farming next, and what do you do about it? ',
      el('strong', { text: '178 protocols' }), ' ranked by what a launch would be worth if the record stayed as it is. ',
      'Every implied value is this radar\u2019s own claim, fitted from the protocols that already trade \u2014 never a price, never a prediction that a token is coming.'));
    hero.appendChild(el('p', {}, 'Snapshot ', el('strong', { text: DATA.as_of }), ' \u00b7 ',
      'Sealed DefiLlama protocol data \u00b7 watchlist floor $50M \u00b7 model ', el('strong', { text: DATA.model_version })));
    wrap.appendChild(hero);

    var kpis = el('section', { class: 'kpis' });
    var top = DATA.rows[0];
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'label', text: 'Board rows' }),
      el('div', { class: 'value', text: String(DATA.board_size) }),
      el('div', { class: 'sub', text: DATA.watchlist_size + ' watchlist + ' + DATA.early_size + ' early below the floor' })));
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'label', text: 'Rank 1 implied value' }),
      el('div', { class: 'value amber', text: fmtUsd(top.implied_value_usd) }),
      el('div', { class: 'sub', text: top.name })));
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'label', text: 'Global multiple' }),
      el('div', { class: 'value', text: DATA.fit.global_multiple.toFixed(3) + '\u00d7' }),
      el('div', { class: 'sub', text: 'median mcap/TVL over ' + DATA.fit.peers + ' live-token peers' })));
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'label', text: 'Leave-one-out check' }),
      el('div', { class: 'value', text: DATA.validation[0].within_2x_pct.toFixed(1) + '%' }),
      el('div', { class: 'sub', text: 'of live peers predicted within 2\u00d7 of their market cap' })));
    wrap.appendChild(kpis);
  }

  function renderTabs(wrap) {
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'Board'], ['live', 'Live token peers'], ['model', 'Model & checks']].forEach(function (t) {
      tabs.appendChild(el('button', {
        role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; render(); },
      }));
    });
    wrap.appendChild(tabs);
  }

  function renderToolbar(wrap) {
    var bar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Search name or slug\u2026', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; renderBoardOnly(); });
    bar.appendChild(search);

    var cat = el('select', { 'aria-label': 'Category' });
    cat.appendChild(el('option', { value: 'all', text: 'All categories' }));
    categories().forEach(function (c) { cat.appendChild(el('option', { value: c, text: c })); });
    cat.value = state.category;
    cat.addEventListener('change', function () { state.category = cat.value; render(); });
    bar.appendChild(cat);

    var ch = el('select', { 'aria-label': 'Chain' });
    ch.appendChild(el('option', { value: 'all', text: 'All chains' }));
    chains().forEach(function (c) { ch.appendChild(el('option', { value: c, text: c })); });
    ch.value = state.chain;
    ch.addEventListener('change', function () { state.chain = ch.value; render(); });
    bar.appendChild(ch);

    var tvl = el('select', { 'aria-label': 'Minimum TVL' });
    [['0', 'Any TVL'], ['50000000', 'TVL \u2265 $50M'], ['100000000', 'TVL \u2265 $100M'], ['500000000', 'TVL \u2265 $500M']].forEach(function (o) {
      tvl.appendChild(el('option', { value: o[0], text: o[1] }));
    });
    tvl.value = state.minTvl;
    tvl.addEventListener('change', function () { state.minTvl = tvl.value; render(); });
    bar.appendChild(tvl);

    var wl = el('label', {},
      el('input', { type: 'checkbox', checked: state.watchlistOnly ? 'checked' : null }),
      document.createTextNode(' Watchlist only'));
    wl.querySelector('input').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; render(); });
    bar.appendChild(wl);
    wrap.appendChild(bar);
  }

  function renderSandbox(wrap) {
    var box = el('details', { class: 'panel sandbox' });
    box.appendChild(el('summary', {}, 'Model sandbox \u2014 change two weights, watch the board re-rank'));
    var note = el('p', { class: 'note' }, 'The sandbox only changes what this page shows. board.json always keeps the fitted model (growth weight 0.5, maturity range 0.6).');
    box.appendChild(note);
    var gw = el('label', {}, 'Growth weight: ', el('span', { class: 'val', text: state.growthWeight.toFixed(2) }));
    var gwInput = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(state.growthWeight) });
    gwInput.addEventListener('input', function () { state.growthWeight = Number(gwInput.value); gw.querySelector('.val').textContent = state.growthWeight.toFixed(2); renderBoardOnly(); });
    box.appendChild(gw);
    box.appendChild(gwInput);
    var mr = el('label', {}, 'Maturity range: ', el('span', { class: 'val', text: state.maturityRange.toFixed(2) }));
    var mrInput = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(state.maturityRange) });
    mrInput.addEventListener('input', function () { state.maturityRange = Number(mrInput.value); mr.querySelector('.val').textContent = state.maturityRange.toFixed(2); renderBoardOnly(); });
    box.appendChild(mr);
    box.appendChild(mrInput);
    var reset = el('button', { text: 'Reset to the fitted model', onclick: function () { state.growthWeight = 0.5; state.maturityRange = 0.6; render(); } });
    box.appendChild(reset);
    wrap.appendChild(box);
  }

  function sortArrow(key) {
    return state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '';
  }

  function renderBoardTable(wrap) {
    var rows = filteredRows();
    wrap.appendChild(el('p', { class: 'count', text: rows.length + ' of ' + DATA.board_size + ' protocols' + (sandboxActive() ? ' \u00b7 sandbox weights active \u2014 values recomputed live' : '') + '. Tap a row for its detail, farm plan and value breakdown.' }));

    if (rows.length === 0) {
      wrap.appendChild(el('p', { class: 'empty', text: 'Nothing matches these filters.' }));
      return;
    }
    var table = el('table', { class: 'board' });
    var head = el('tr');
    [['rank', '#'], ['name', 'Protocol'], ['category', 'Category'], ['chains', 'Chains'], ['tvl', 'TVL'], ['age', 'Age'], ['implied', 'Implied value'], ['odds', 'Launch odds'], ['hour', '$/h']].forEach(function (h) {
      var th = el('th', { text: h[1] });
      if (h[0] === 'rank' || h[0] === 'implied' || h[0] === 'tvl' || h[0] === 'age' || h[0] === 'odds' || h[0] === 'name') {
        th.textContent = h[1] + sortArrow(h[0] === 'rank' ? 'implied' : h[0]);
        th.addEventListener('click', function () {
          var key = h[0] === 'rank' ? 'implied' : h[0];
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
          render();
        });
      }
      if (h[0] === 'rank' || h[0] === 'tvl' || h[0] === 'age' || h[0] === 'implied' || h[0] === 'odds' || h[0] === 'hour') th.className = 'num';
      head.appendChild(th);
    });
    table.appendChild(el('thead', {}, head));
    var body = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', { onclick: function () { state.selected = state.selected === r.slug ? null : r.slug; render(); } });
      if (state.selected === r.slug) tr.className = 'sel';
      tr.appendChild(el('td', { class: 'num', text: String(r.rank) }));
      var nameCell = el('td');
      nameCell.appendChild(el('span', { class: 'name', text: r.name }));
      if (r.watchlist) nameCell.appendChild(el('span', { class: 'badge', text: 'WATCHLIST' }));
      nameCell.appendChild(el('br'));
      nameCell.appendChild(el('span', { class: 'slug', text: r.slug }));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', { text: r.category || 'Unknown' }));
      var chainCell = el('td');
      r.chains.slice(0, 3).forEach(function (c) { chainCell.appendChild(el('span', { class: 'chip', text: c })); });
      if (r.chains.length > 3) chainCell.appendChild(el('span', { class: 'chip', text: '+' + (r.chains.length - 3) }));
      tr.appendChild(chainCell);
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num', text: fmtAge(r.age_days) }));
      tr.appendChild(el('td', { class: 'num' }, el('span', { class: 'val', text: fmtUsd(shownImplied(r)) })));
      tr.appendChild(el('td', { class: 'num', text: r.odds_low_pct.toFixed(1) + '\u2013' + r.odds_high_pct.toFixed(1) + '%' }));
      tr.appendChild(el('td', { class: 'num', text: '$' + r.usd_per_hour.toFixed(2) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
  }

  function renderDrawer(wrap) {
    if (!state.selected) return;
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return;
    var recomputed = impliedOf(row, 0.5, 0.6);
    var d = el('section', { class: 'drawer', 'aria-label': 'Protocol detail' });
    d.appendChild(el('button', { class: 'close', text: 'Close', onclick: function () { state.selected = null; render(); } }));
    var h = el('h2', {}, row.name + ' ');
    h.appendChild(el('span', { class: 'slug', text: row.slug + ' \u00b7 rank #' + row.rank + (row.watchlist ? ' \u00b7 on the watchlist' : '') }));
    d.appendChild(h);
    d.appendChild(el('p', { class: 'meta', text: (row.category || 'Unknown') + ' \u00b7 ' + row.chains.join(', ') + ' \u00b7 TVL ' + fmtUsd(row.tvl_usd) + ' \u00b7 7d ' + fmtPct(row.change_7d) + ' \u00b7 age ' + fmtAge(row.age_days) + ' \u00b7 records no token' }));

    var math = el('div', { class: 'math' });
    function mrow(label, value) {
      math.appendChild(el('div', { class: 'row' }, el('span', { text: label }), el('span', { class: 'v', text: value })));
    }
    mrow('TVL', fmtUsd(row.tvl_usd));
    mrow('Category multiple (' + (row.category || 'Unknown') + ', fitted)', row.multiple.toFixed(3) + '\u00d7');
    mrow('Size adjustment', row.size_multiplier.toFixed(2) + '\u00d7');
    mrow('Growth multiplier (7d ' + fmtPct(row.change_7d) + ')', row.growth_multiplier.toFixed(2) + '\u00d7');
    mrow('Maturity multiplier (' + fmtAge(row.age_days) + ' with no token)', row.maturity_multiplier.toFixed(2) + '\u00d7');
    var total = el('div', { class: 'row total' }, el('span', { text: 'Implied value' }), el('span', { class: 'v', text: fmtUsd(row.implied_value_usd) }));
    math.appendChild(total);
    d.appendChild(math);
    d.appendChild(el('p', { class: 'note', text: 'This page recomputes the value from the same figures: ' + fmtUsd(recomputed) + ' \u2014 ' + (recomputed === row.implied_value_usd ? 'matches board.json.' : 'differs from board.json (sandbox weights active).') }));

    var odds = el('div', { class: 'odds' });
    odds.appendChild(el('h3', { text: 'Launch odds (12 months, as a range)' }));
    odds.appendChild(el('p', {}, el('strong', { text: row.odds_low_pct.toFixed(1) + '%\u2013' + row.odds_high_pct.toFixed(1) + '%' }),
      ' \u2014 protocols in its cohort (' + row.cohort_n + ' in the snapshot, ' + row.cohort_share_pct.toFixed(1) + '% already record a token) sit in this range. A range, not a point: it says how often protocols like this one have tokens, never that this one will launch.'));
    var bar = el('div', { class: 'bar' });
    bar.appendChild(el('i', { style: 'left:' + row.odds_low_pct + '%;width:' + Math.max(1, row.odds_high_pct - row.odds_low_pct) + '%;' }));
    odds.appendChild(bar);
    d.appendChild(odds);

    d.appendChild(el('h3', { text: 'Farm plan \u2014 costed' }));
    d.appendChild(el('p', { class: 'planline' }, 'Capital ', el('strong', { text: '$' + row.capital_usd }), ' \u00b7 gas about ', el('strong', { text: '$' + row.gas_per_week_usd.toFixed(2) + '/week' }), ' \u00b7 time about ', el('strong', { text: row.minutes_per_week + ' min/week' }), ' \u00b7 ', el('strong', { text: '$' + row.usd_per_hour.toFixed(2) + ' of gas per hour of your time' })));
    var ol = el('ol', { class: 'steps' });
    row.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    d.appendChild(ol);
    wrap.appendChild(d);
  }

  function renderLive(wrap) {
    wrap.appendChild(el('p', {}, 'The market\u2019s own values: the ', el('strong', { text: '24 largest live-token protocols' }),
      ' by market cap (exchanges left out). These are the peers the category multiples were fitted on \u2014 the board never mixes them into the ranking, because a protocol whose token already trades is not a launch to farm.'));
    var table = el('table', { class: 'board' });
    var head = el('tr');
    ['#', 'Protocol', 'Category', 'TVL', 'Market cap', 'mcap / TVL'].forEach(function (h, i) {
      head.appendChild(el('th', { class: i >= 3 ? 'num' : '', text: h }));
    });
    table.appendChild(el('thead', {}, head));
    var body = el('tbody');
    DATA.live.forEach(function (r, i) {
      var tr = el('tr');
      tr.appendChild(el('td', { class: 'num', text: String(i + 1) }));
      var nc = el('td');
      nc.appendChild(el('span', { class: 'name', text: r.name }));
      nc.appendChild(el('br'));
      nc.appendChild(el('span', { class: 'slug', text: r.slug }));
      tr.appendChild(nc);
      tr.appendChild(el('td', { text: r.category || 'Unknown' }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }));
      tr.appendChild(el('td', { class: 'num', text: r.mcap_tvl === null ? 'n/a' : r.mcap_tvl.toFixed(3) + '\u00d7' }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    wrap.appendChild(el('p', { class: 'note', text: '16 protocols record a token with a zero or negative market cap; they were counted and left out of the fit.' }));
  }

  function renderModel(wrap) {
    var fit = DATA.fit;
    var p = el('section', { class: 'panel' });
    p.appendChild(el('h2', { text: 'The model, fitted \u2014 radar-fit-1' }));
    p.appendChild(el('p', {}, 'Nothing here is hand-picked. At run time the program fits the model on the ',
      el('strong', { text: String(fit.peers) + ' live-token peers' }),
      ' in this snapshot (protocols that already trade, positive market cap and TVL, outside the excluded categories), then scores every pre-token protocol with the same function. No protocol name is ever special-cased.'));
    p.appendChild(el('p', {}, el('strong', { text: 'implied = TVL \u00d7 multiple \u00d7 size \u00d7 growth \u00d7 maturity' })));
    var ul = el('ul');
    ul.appendChild(el('li', {}, el('strong', { text: 'multiple: ' }), 'the category\u2019s median mcap/TVL among its live peers, winsorised at the 90th percentile (' + fit.winsor_p90.toFixed(3) + '\u00d7) and shrunk toward the global median (' + fit.global_multiple.toFixed(3) + '\u00d7) with 5 pseudo-observations. A category with one peer leans on the market, not on that peer alone.'));
    ul.appendChild(el('li', {}, el('strong', { text: 'size: ' }), 'log-log fit of market cap on TVL across the peers: slope ' + fit.size_slope.toFixed(2) + ', shrunk 75% toward no size effect (exponent ' + fit.size_exponent.toFixed(2) + '), clamped to 0.70\u20131.50. Big protocols are worth less per TVL dollar. Median peer TVL ' + fmtUsd(fit.median_peer_tvl) + '.'));
    ul.appendChild(el('li', {}, el('strong', { text: 'growth: ' }), 'the 7-day TVL change, clamped to \u221260% / +120%, at half weight.'));
    ul.appendChild(el('li', {}, el('strong', { text: 'maturity: ' }), '0.55 at listing, rising to 1.15 over four years with no token; unknown age counts as one year.'));
    p.appendChild(ul);

    p.appendChild(el('h3', { text: 'Category multiples (fitted)' }));
    var ct = el('table', { class: 'mini' });
    var ch = el('tr');
    ['Category', 'Peers', 'Peer median', 'Multiple used'].forEach(function (h, i) {
      ch.appendChild(el('th', { class: i > 0 ? 'num' : '', text: h }));
    });
    ct.appendChild(el('thead', {}, ch));
    var cb = el('tbody');
    fit.categories.forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: c.category }));
      tr.appendChild(el('td', { class: 'num', text: String(c.peers) }));
      tr.appendChild(el('td', { class: 'num', text: c.median.toFixed(3) + '\u00d7' }));
      tr.appendChild(el('td', { class: 'num', text: c.multiple.toFixed(3) + '\u00d7' }));
      cb.appendChild(tr);
    });
    ct.appendChild(cb);
    p.appendChild(ct);
    p.appendChild(el('p', { class: 'note', text: 'Categories with no live peers use the global median ' + fit.global_multiple.toFixed(3) + '\u00d7. Risk Curators rests on a single live peer, so its multiple is mostly the global median \u2014 the board says so rather than hiding it.' }));

    p.appendChild(el('h3', { text: 'Held-out checks (run at build time, on the live peers)' }));
    var vt = el('table', { class: 'mini' });
    var vh = el('tr');
    ['Check', 'Protocols', 'Median |log error|', 'Within 2\u00d7 of market cap'].forEach(function (h, i) {
      vh.appendChild(el('th', { class: i > 0 ? 'num' : '', text: h }));
    });
    vt.appendChild(el('thead', {}, vh));
    var vb = el('tbody');
    DATA.validation.forEach(function (v) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: v.name === 'leave-one-out' ? 'Leave-one-out: refit without the peer, predict its market cap' : 'Walk-forward: fit on the older half by listing date, predict the newer half' }));
      tr.appendChild(el('td', { class: 'num', text: String(v.n) }));
      tr.appendChild(el('td', { class: 'num', text: v.median_abs_log_error.toFixed(2) }));
      tr.appendChild(el('td', { class: 'num', text: v.within_2x_pct.toFixed(1) + '%' }));
      vb.appendChild(tr);
    });
    vt.appendChild(vb);
    p.appendChild(vt);
    p.appendChild(el('p', { class: 'note', text: 'Growth and maturity are 1 in these checks: they test the fitted multiple and size term against the market\u2019s own values. Read them as a calibration diagnostic, not a price forecast: the peers\u2019 mcap/TVL ratios span 0.017\u00d7 to 400\u00d7, so no TVL-based multiple predicts any single token\u2019s market cap tightly \u2014 the multiples capture the level by category, and the board ranks on that level.' }));

    p.appendChild(el('h3', { text: 'Launch odds: the cohort table' }));
    p.appendChild(el('p', {}, 'For each age band and TVL tier, the share of protocols in this snapshot that already record a token, with a Wilson 90% interval. A row\u2019s odds are its own cohort\u2019s interval.'));
    var ot = el('table', { class: 'mini' });
    var oh = el('tr');
    ['Age band', 'TVL tier', 'Protocols', 'Already have a token', 'Odds range'].forEach(function (h, i) {
      oh.appendChild(el('th', { class: i > 1 ? 'num' : '', text: h }));
    });
    ot.appendChild(el('thead', {}, oh));
    var ob = el('tbody');
    DATA.cohorts.forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: c.band === 'unknown' ? 'age unknown' : c.band + ' days' }));
      tr.appendChild(el('td', { text: c.tier === 'high' ? '\u2265 $50M' : '$5M\u2013$50M' }));
      tr.appendChild(el('td', { class: 'num', text: String(c.n) }));
      tr.appendChild(el('td', { class: 'num', text: (c.share * 100).toFixed(1) + '%' }));
      tr.appendChild(el('td', { class: 'num', text: c.low_pct.toFixed(1) + '%\u2013' + c.high_pct.toFixed(1) + '%' }));
      ob.appendChild(tr);
    });
    ot.appendChild(ob);
    p.appendChild(ot);
    wrap.appendChild(p);

    var ig = el('section', { class: 'panel' });
    ig.appendChild(el('h2', { text: 'Integrity: all 758 protocols accounted for' }));
    var it = DATA.integrity;
    var iu = el('ul');
    iu.appendChild(el('li', {}, el('strong', { text: it.ranked + ' ranked: ' }), it.watchlist + ' on the watchlist + ' + it.early_below_floor + ' early below the $50M floor.'));
    iu.appendChild(el('li', {}, el('strong', { text: it.above_floor_not_watchlist + ' above the floor, not on the watchlist: ' }), 'left off, because the watchlist is the house\u2019s own application of the exclusion rule with data the snapshot does not carry (DefiLlama\u2019s parentProtocol). ' + it.above_floor_not_watchlist_slugs.join(', ') + '.'));
    iu.appendChild(el('li', {}, el('strong', { text: it.excluded_pre_token + ' pre-token protocols excluded by the rule: ' }), Object.keys(it.excluded_reasons).map(function (k) { return k + ' ' + it.excluded_reasons[k]; }).join(', ') + '.'));
    iu.appendChild(el('li', {}, el('strong', { text: it.live_token + ' already record a token: ' }), 'kept apart on the Live token tab; ' + it.fit_peers + ' of them are the peers the multiples were fitted on.'));
    ig.appendChild(iu);
    ig.appendChild(el('p', { class: 'note', text: 'The list says a protocol records no token, never that it has none: DefiLlama\u2019s record is not proof. Wrapped, staked and bridged products of tokens that already trade are off the board by rule \u2014 that is why Binance staked ETH and WBTC are not ranked here.' }));
    wrap.appendChild(ig);
  }

  function renderFooter(wrap) {
    var f = el('footer');
    f.appendChild(el('p', { text: 'Source: sealed DefiLlama snapshot of ' + DATA.as_of + ' (' + DATA.source + '). Implied values and launch odds are this radar\u2019s own claims, fitted from the snapshot at run time. Nothing here is investment advice; a farm plan\u2019s costs are estimates in gas and time, and no step asks you to pay to claim anything.' }));
    wrap.appendChild(f);
  }

  function render() {
    app.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    app.appendChild(wrap);
    renderHeader(wrap);
    renderTabs(wrap);
    if (state.tab === 'board') {
      renderToolbar(wrap);
      renderSandbox(wrap);
      renderDrawer(wrap);
      renderBoardTable(wrap);
    } else if (state.tab === 'live') {
      renderLive(wrap);
    } else {
      renderModel(wrap);
    }
    renderFooter(wrap);
    app.setAttribute('aria-busy', 'false');
  }

  // Re-render only the table (and its count) while typing in the search box or moving a
  // sandbox slider, so the input keeps focus.
  function renderBoardOnly() {
    var wrap = app.querySelector('.wrap');
    if (!wrap) { render(); return; }
    var tables = wrap.querySelectorAll('table.board, p.count');
    tables.forEach(function (n) { n.remove(); });
    var footer = wrap.querySelector('footer');
    var anchor = footer;
    var tmp = document.createElement('div');
    renderBoardTable(tmp);
    while (tmp.firstChild) wrap.insertBefore(tmp.firstChild, anchor);
  }

  render();
})();
