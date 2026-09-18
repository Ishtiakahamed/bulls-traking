/* ===================== Bulls Traking Phase 1 Application ===================== */

const API = '/api';

const CHAINS = {
  all: { label: 'All Chains', key: 'all' },
  'solana-ecosystem': { label: 'Solana', key: 'solana-ecosystem' },
  'ethereum-ecosystem': { label: 'Ethereum', key: 'ethereum-ecosystem' },
  'binance-smart-chain': { label: 'BNB Chain', key: 'binance-smart-chain' },
  'base-ecosystem': { label: 'Base', key: 'base-ecosystem' }
};

const app = document.getElementById('app');
let state = {
  chain: 'all',
  tab: 'trending',
  page: 1,
  limit: 25,
  homeData: null
};

/* ---------------- helpers ---------------- */

const fmtPrice = (n) => {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1) return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n === 0) return '$0';
  const decimals = n < 0.0001 ? 8 : 6;
  return '$' + Number(n).toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
};

const fmtUsd = (n) => {
  if (n == null || isNaN(n) || n === 0) return 'N/A';
  const num = Number(n);
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
  return '$' + num.toFixed(0);
};

const fmtChg = (n) => {
  if (n == null || isNaN(n)) return '<span class="chg flat">N/A</span>';
  const num = Number(n);
  const cls = num > 0 ? 'up' : num < 0 ? 'down' : 'flat';
  const sign = num > 0 ? '+' : '';
  return `<span class="chg ${cls}">${sign}${num.toFixed(2)}%</span>`;
};

const escapeHtml = (s) => (s || '').toString().replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const fmtAge = (d) => {
  if (!d) return '—';
  let s = String(d).trim();
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('GMT')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const diffMs = Date.now() - new Date(s).getTime();
  if (isNaN(diffMs) || diffMs < 5000) return 'Just now';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const getTokenFallbackAvatar = (symbol = '', name = '') => {
  const cleanSym = String(symbol || name || '?').slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < cleanSym.length; i++) {
    hash = cleanSym.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><defs><linearGradient id="g_${hue1}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue1},68%,48%)"/><stop offset="100%" stop-color="hsl(${hue2},82%,32%)"/></linearGradient></defs><circle cx="18" cy="18" r="18" fill="url(#g_${hue1})"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" font-weight="800" fill="#ffffff">${cleanSym || '?'}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

const normalizeTokenLogo = (url, symbol = '', name = '') => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return getTokenFallbackAvatar(symbol, name);
  }
  let u = url.trim();
  const hashMatch = u.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) {
    return `https://pump.mypinata.cloud/ipfs/${hashMatch[1]}`;
  }
  return u;
};

/* ---------------- Watchlist helpers (Phase 3 Task 2) ---------------- */

const WATCHLIST_KEY = 'bt_watchlist';

function getWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isWatchlisted(id) {
  if (!id) return false;
  const list = getWatchlist();
  return list.some(item => String(item) === String(id));
}

function toggleWatchlist(id, btnElement) {
  if (!id) return;
  let list = getWatchlist();
  const strId = String(id);
  const exists = list.some(item => String(item) === strId);

  if (exists) {
    list = list.filter(item => String(item) !== strId);
  } else {
    list.push(strId);
  }

  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch (e) {}

  const isNowActive = !exists;
  document.querySelectorAll(`.watch-star[data-token-id="${strId}"]`).forEach(btn => {
    btn.classList.toggle('is-active', isNowActive);
    btn.title = isNowActive ? 'Remove from Watchlist' : 'Add to Watchlist';
  });

  if (btnElement) {
    btnElement.classList.toggle('is-active', isNowActive);
  }

  if (location.hash.startsWith('#/watchlist')) {
    renderWatchlistPage();
  }
}
window.toggleWatchlist = toggleWatchlist;

function sparklineSvg(prices, positive) {
  if (!prices || prices.length < 2) return '';
  const w = 70, h = 22;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = (max - min) || 1;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(' ');
  const color = positive ? '#00e676' : '#ff3d71';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

async function fetchApi(endpoint, options = {}) {
  const res = await fetch(`${API}${endpoint}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed: ' + res.status }));
    throw new Error(err.error || 'Server error');
  }
  return res.json();
}

/* ---------------- ticker tape ---------------- */

function populateTape(tokens) {
  const track = document.getElementById('tapeTrack');
  if (!track || !tokens || tokens.length === 0) return;
  const items = tokens.map((c) => {
    const chg = c.change_24h;
    const cls = chg > 0 ? 'up' : 'down';
    const sign = chg > 0 ? '+' : '';
    return `<span class="tape-item" data-ticker-symbol="${escapeHtml(c.symbol)}"><b>${escapeHtml(c.symbol)}</b><span class="ticker-price">${fmtPrice(c.price)}</span><span class="${cls}">${sign}${(chg ?? 0).toFixed(1)}%</span></span>`;
  });
  track.innerHTML = items.join('') + items.join('');
}

async function loadTape() {
  if (state.homeData && state.homeData.trending) {
    populateTape(state.homeData.trending.slice(0, 12));
    return;
  }
  try {
    const res = await fetchApi('/tokens/trending?limit=12');
    populateTape(res.tokens);
  } catch (e) {
    const tape = document.getElementById('tape');
    if (tape) tape.style.display = 'none';
  }
}

/* ---------------- update market status ---------------- */

function updateMarketStatus(stats) {
  const elem = document.getElementById('marketStatus');
  if (!elem || !stats) return;

  if (stats.providerStatus === 'delayed') {
    elem.className = 'market-status-indicator delayed';
    elem.textContent = '● Market Data Delayed';
  } else {
    elem.className = 'market-status-indicator';
    elem.innerHTML = '<span class="live-pulse"></span> Market Live Stream';
  }
}

/* ---------------- render table rows helper & badges ---------------- */

function renderSourceBadge(t) {
  const badges = [];

  const isCmc = (t.logo_url && t.logo_url.includes('coinmarketcap')) ||
                (t.provider_id && !isNaN(Number(t.provider_id)) && !t.provider_id.startsWith('0x')) ||
                Boolean(t.cmc_id) ||
                (t.market_cap_rank != null && t.market_cap_rank > 0 && t.market_cap_rank <= 100);

  const isCg = Boolean(t.coingecko_id) ||
               (t.logo_url && t.logo_url.includes('coingecko')) ||
               (t.provider_id && isNaN(Number(t.provider_id)) && !t.provider_id.startsWith('0x') && t.provider_id !== 'bulls-traking');

  const isDex = Boolean(t.liquidity > 0) || 
                (t.contract_address && t.contract_address.length > 20 && (t.is_submitted === 1 || (!isCg && !isCmc)));

  if (isCmc) {
    badges.push(`
      <span class="source-tag cmc" title="Verified market telemetry via CoinMarketCap Pro">
        <img src="assets/coinmarketcap.png" class="source-mini-logo" alt="CMC">
        <span>CMC</span>
      </span>
    `);
  }

  if (isCg) {
    badges.push(`
      <span class="source-tag cg" title="Verified market telemetry via CoinGecko API">
        <img src="assets/coingecko.png" class="source-mini-logo" alt="CG">
        <span>CG</span>
      </span>
    `);
  }

  if (isDex || badges.length === 0) {
    badges.push(`
      <span class="source-tag dex" title="On-chain telemetry & LP depth via DexScreener">
        <img src="assets/dexscreener.png" class="source-mini-logo" alt="DEX">
        <span>DEX</span>
      </span>
    `);
  }

  return badges.join('');
}

function renderSocialLinks(t) {
  const links = [];

  if (t.website_url) {
    links.push(`
      <a href="${escapeHtml(t.website_url)}" target="_blank" rel="noopener noreferrer" class="social-btn web" title="Website" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </a>
    `);
  }

  if (t.x_url) {
    links.push(`
      <a href="${escapeHtml(t.x_url)}" target="_blank" rel="noopener noreferrer" class="social-btn x" title="X / Twitter" onclick="event.stopPropagation();">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
    `);
  }

  if (t.telegram_url) {
    links.push(`
      <a href="${escapeHtml(t.telegram_url)}" target="_blank" rel="noopener noreferrer" class="social-btn tg" title="Telegram Community" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
      </a>
    `);
  }

  if (t.reddit_url) {
    links.push(`
      <a href="${escapeHtml(t.reddit_url)}" target="_blank" rel="noopener noreferrer" class="social-btn reddit" title="Reddit Community" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702zM9.25 12C8.56 12 8 12.56 8 13.25c0 .687.56 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
      </a>
    `);
  }

  if (links.length === 0) {
    return `<div class="social-links-cell" onclick="event.stopPropagation();"><span style="color:var(--text-faint);font-size:11px;">—</span></div>`;
  }

  return `
    <div class="social-links-cell" onclick="event.stopPropagation();">
      ${links.join('')}
    </div>
  `;
}

function renderTokenRows(tokens, { showAge = false, showHot = false } = {}) {
  if (!tokens || tokens.length === 0) {
    return `<tr><td colspan="14" class="state-msg">No tokens found matching this view.</td></tr>`;
  }

  return tokens.map((t, idx) => {
    const isPositive = (t.change_24h ?? 0) >= 0;
    const spark = sparklineSvg(t.sparkline, isPositive);
    const isSubmitted = t.is_submitted === 1;

    const txnCount = (t.txn_count_24h != null && t.txn_count_24h > 0) ? Number(t.txn_count_24h).toLocaleString() : '—';
    const lpVal = (t.liquidity != null && t.liquidity > 0) ? fmtUsd(t.liquidity) : '—';
    const chg6h = t.price_change_6h != null ? fmtChg(t.price_change_6h) : '—';
    const starred = isWatchlisted(t.id);

    return `
      <tr data-token-symbol="${escapeHtml(t.symbol)}" data-token-id="${t.id}" onclick="location.hash='#/token/${t.id}'">
        <td class="cell-star" onclick="event.stopPropagation();">
          <button class="watch-star ${starred ? 'is-active' : ''}" data-token-id="${t.id}" title="${starred ? 'Remove from Watchlist' : 'Add to Watchlist'}" onclick="event.stopPropagation(); toggleWatchlist('${t.id}', this)">★</button>
        </td>
        <td>${t.market_cap_rank || idx + 1}</td>
        <td>
          <div class="token-cell">
            <img src="${escapeHtml(normalizeTokenLogo(t.logo_url, t.symbol, t.name))}" alt="${escapeHtml(t.symbol)}" class="token-avatar" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(t.symbol)}', '${escapeHtml(t.name)}');">
            <div class="token-meta">
              <div class="token-title-row">
                <span class="token-name">${escapeHtml(t.name)}</span>
                <span class="token-sym">${escapeHtml(t.symbol)}</span>
                ${renderSourceBadge(t)}
                ${isSubmitted ? '<span class="badge-new">NEW</span>' : ''}
                ${showAge && t.age ? `<span class="badge-age">${escapeHtml(t.age)}</span>` : ''}
                ${showHot ? `<span class="badge-hot">${t.hot_score}</span>` : ''}
              </div>
              <div class="token-chain-row">
                <span class="chain-tag">${escapeHtml(t.chain ? t.chain.replace('-ecosystem', '') : '')}</span>
              </div>
            </div>
          </div>
        </td>
        <td class="cell-price"><b>${fmtPrice(t.price)}</b></td>
        <td>${fmtChg(t.change_1h)}</td>
        <td class="cell-change">${fmtChg(t.change_24h)}</td>
        <td>${fmtChg(t.change_7d)}</td>
        <td>${chg6h}</td>
        <td>${txnCount}</td>
        <td>${lpVal}</td>
        <td>${fmtUsd(t.volume_24h)}</td>
        <td>${fmtUsd(t.market_cap)}</td>
        <td class="cell-socials" onclick="event.stopPropagation();">
          ${renderSocialLinks(t)}
        </td>
        <td>${spark}</td>
      </tr>
    `;
  }).join('');
}

/* ---------------- 1. HOME VIEW ---------------- */

let homeState = {
  tab: 'trending',
  page: 1,
  limit: 20,
  chain: 'all',
  total: 0
};

async function renderHome() {
  app.innerHTML = `<div class="state-msg">Loading Bulls Traking market data…</div>`;

  try {
    homeState.page = 1;
    homeState.chain = state.chain || 'all';
    // Fetch initial home aggregator with 20 items per tab and market stats
    const res = await fetchApi(`/home?chain=${homeState.chain}&limit=20&page=1`);
    const data = res.data;
    state.homeData = data;

    updateMarketStatus(data.marketStats);
    if (data.trending && data.trending.length > 0) {
      populateTape(data.trending.slice(0, 12));
    }

    const initialKey = homeState.tab === 'top' ? 'topCoins' : homeState.tab;
    const initialTokens = data[initialKey] || [];

function renderPromotedCard(p) {
  const chainName = (p.chain || '').replace('-ecosystem', '').replace('binance-smart-chain', 'BSC').toUpperCase();
  const tradeUrl = p.auto_trading_url || (p.contract_address ? `https://dexscreener.com/search?q=${encodeURIComponent(p.contract_address)}` : null);

  return `
    <div class="promoted-card" onclick="location.hash='#/token/${p.token_id}'">
      <div class="promoted-meta">
        <img class="promoted-logo" src="${escapeHtml(normalizeTokenLogo(p.logo_url, p.symbol, p.name))}" alt="${escapeHtml(p.symbol)}" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(p.symbol)}', '${escapeHtml(p.name)}');">
        <div>
          <div class="promoted-name">
            ${escapeHtml(p.name)} <span class="badge-promoted">PROMOTED</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">${escapeHtml(chainName)}</span>
            ${tradeUrl ? `<a href="${escapeHtml(tradeUrl)}" target="_blank" rel="noopener" class="btn-promoted-trade" onclick="event.stopPropagation();" title="Trade on DEX">🚀 Trade ↗</a>` : ''}
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="promoted-price">${fmtPrice(p.price)}</div>
        <div>${fmtChg(p.change_24h)}</div>
        <div style="margin-top:4px;">
          ${renderSocialLinks(p)}
        </div>
      </div>
    </div>
  `;
}

    const promotedCards = (data.promoted || []).map(renderPromotedCard).join('');

    app.innerHTML = `
      <!-- PROMOTED TOKENS SECTION -->
      ${data.promoted && data.promoted.length > 0 ? `
        <section class="promoted-section">
          <h3 class="section-headline">Promoted Tokens</h3>
          <div class="promoted-grid">${promotedCards}</div>
        </section>
      ` : ''}

      <!-- TABS & CHAIN CONTROLS -->
      <div class="controls-bar">
        <div class="subtabs" id="homeTabs">
          <span class="subtab ${homeState.tab === 'trending' ? 'is-active' : ''}" data-tab="trending">Trending</span>
          <span class="subtab ${homeState.tab === 'top' ? 'is-active' : ''}" data-tab="top">Top Coins</span>
          <span class="subtab ${homeState.tab === 'new' ? 'is-active' : ''}" data-tab="new">New Coins</span>
          <span class="subtab ${homeState.tab === 'hot' ? 'is-active' : ''}" data-tab="hot">Hot Coins</span>
          <span class="subtab ${homeState.tab === 'gainers' ? 'is-active' : ''}" data-tab="gainers">Top Gainers</span>
        </div>
      </div>

      <!-- TOKEN TABLE -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:32px;"></th>
              <th>#</th>
              <th>Token</th>
              <th>Price</th>
              <th>1h</th>
              <th>24h</th>
              <th>7d</th>
              <th>6h</th>
              <th>TXN</th>
              <th>LP</th>
              <th>24h Volume</th>
              <th>Market Cap</th>
              <th>Socials</th>
              <th>Last 7 Days</th>
            </tr>
          </thead>
          <tbody id="homeTableBody">
            ${initialTokens.length > 0 ? renderTokenRows(initialTokens, {
              showAge: homeState.tab === 'new',
              showHot: homeState.tab === 'hot'
            }) : '<tr><td colspan="14" class="state-msg">Loading tokens…</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- PAGINATION CONTROLS (20 TOKENS PER PAGE ACROSS 500+ POOL) -->
      <div id="homePaginationWrap" class="home-pagination-wrap"></div>
    `;

    // Function to load tab data with pagination
    async function loadHomeTab(tabName, page = 1, append = false) {
      homeState.tab = tabName;
      homeState.page = page;
      const tbody = document.getElementById('homeTableBody');
      const pagWrap = document.getElementById('homePaginationWrap');

      // Fast-path: render page 1 instantly from pre-fetched home aggregator without duplicate network call
      const tabKey = tabName === 'top' ? 'topCoins' : tabName;
      if (page === 1 && !append && data && data[tabKey] && data[tabKey].length > 0) {
        const tokens = data[tabKey];
        const total = data.pagination?.[`${tabName}Total`] || data.marketStats?.totalTokens || 1009;
        homeState.total = total;
        const totalPages = Math.max(1, Math.ceil(total / homeState.limit));

        tbody.innerHTML = renderTokenRows(tokens, {
          showAge: tabName === 'new',
          showHot: tabName === 'hot'
        });

        renderHomePagination(pagWrap, {
          tabName,
          page: 1,
          limit: homeState.limit,
          total,
          totalPages,
          loadedCount: tokens.length
        });
        return;
      }

      if (!append) {
        tbody.innerHTML = `<tr><td colspan="14" class="state-msg">Loading ${tabName} tokens (Page ${page})…</td></tr>`;
      }

      try {
        let endpoint = `/tokens/${tabName}?chain=${homeState.chain}&page=${page}&limit=${homeState.limit}`;
        if (tabName === 'top') endpoint = `/tokens/top?chain=${homeState.chain}&page=${page}&limit=${homeState.limit}`;

        const res = await fetchApi(endpoint);
        const tokens = res.tokens || [];
        const total = res.pagination?.total || data.marketStats?.totalTokens || 1009;
        homeState.total = total;
        const totalPages = Math.max(1, Math.ceil(total / homeState.limit));

        if (append) {
          tbody.insertAdjacentHTML('beforeend', renderTokenRows(tokens, {
            showAge: tabName === 'new',
            showHot: tabName === 'hot'
          }));
        } else {
          tbody.innerHTML = renderTokenRows(tokens, {
            showAge: tabName === 'new',
            showHot: tabName === 'hot'
          });
        }

        renderHomePagination(pagWrap, {
          tabName,
          page,
          limit: homeState.limit,
          total,
          totalPages,
          loadedCount: append ? (tbody.querySelectorAll('tr[data-token-id]').length) : tokens.length
        });
      } catch (e) {
        if (!append) {
          tbody.innerHTML = `<tr><td colspan="14" class="state-msg">Unable to load tokens: ${escapeHtml(e.message)}</td></tr>`;
        }
      }
    }

    function renderHomePagination(container, meta) {
      if (!container) return;
      const { tabName, page, limit, total, totalPages, loadedCount } = meta;
      const start = ((page - 1) * limit) + 1;
      const end = Math.min(total, start + loadedCount - 1);

      // Compute page numbers to display
      const pagesToShow = [];
      pagesToShow.push(1);
      for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) {
        if (!pagesToShow.includes(p)) pagesToShow.push(p);
      }
      if (totalPages > 1 && !pagesToShow.includes(totalPages)) {
        pagesToShow.push(totalPages);
      }

      let pageBtnsHtml = '';
      pagesToShow.forEach((p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) {
          pageBtnsHtml += `<span class="page-ellipsis">…</span>`;
        }
        pageBtnsHtml += `<button class="page-btn ${p === page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
      });

      container.innerHTML = `
        <div class="pagination-bar">
          <div class="pagination-info">
            Showing <b>${start.toLocaleString()}–${end.toLocaleString()}</b> of <b>${total.toLocaleString()}</b> tokens
            <span class="source-verified-note">
              • Verified live data via 
              <img src="assets/coinmarketcap.png" class="source-logo-inline" alt="CoinMarketCap"> CoinMarketCap Pro,
              <img src="assets/coingecko.png" class="source-logo-inline" alt="CoinGecko"> CoinGecko 
              &amp; <img src="assets/dexscreener.png" class="source-logo-inline" alt="DexScreener"> DexScreener
            </span>
          </div>
          <div class="pagination-actions">
            <button class="btn-ghost btn-prev" ${page <= 1 ? 'disabled' : ''}>‹ Previous</button>
            <div class="page-numbers">${pageBtnsHtml}</div>
            <button class="btn-ghost btn-next" ${page >= totalPages ? 'disabled' : ''}>Next ›</button>
            <button class="btn-ghost btn-load-more" ${page >= totalPages ? 'style="display:none;"' : ''}>Load More (+20)</button>
          </div>
        </div>
      `;

      container.querySelector('.btn-prev')?.addEventListener('click', () => {
        if (page > 1) {
          loadHomeTab(homeState.tab, page - 1, false);
          document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      container.querySelector('.btn-next')?.addEventListener('click', () => {
        if (page < totalPages) {
          loadHomeTab(homeState.tab, page + 1, false);
          document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetPage = parseInt(btn.dataset.page, 10);
          if (targetPage !== page) {
            loadHomeTab(homeState.tab, targetPage, false);
            document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
      container.querySelector('.btn-load-more')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Loading…';
        loadHomeTab(homeState.tab, page + 1, true);
      });
    }

    // Bind Home tabs
    document.getElementById('homeTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.subtab');
      if (!tab) return;
      const targetTab = tab.dataset.tab;
      document.querySelectorAll('#homeTabs .subtab').forEach(el => el.classList.remove('is-active'));
      tab.classList.add('is-active');
      loadHomeTab(targetTab, 1, false);
    });



    // Initial load of first 20 tokens
    loadHomeTab(homeState.tab, 1, false);

  } catch (err) {
    app.innerHTML = `<div class="state-msg">Unable to load market data: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- 2. TOP COINS VIEW (/top-coins) ---------------- */

async function renderTopCoins() {
  state.page = 1;

  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Top Coins by Market Cap</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Explore top cryptocurrencies ranked strictly by market capitalization across verified chains.</p>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>Rank</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>6h</th><th>TXN</th><th>LP</th>
            <th>24h Volume</th><th>Market Cap</th><th>Socials</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="topTableBody">
          <tr><td colspan="14" class="state-msg">Loading Top Coins…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-wrap" id="topPagination" style="text-align:center;margin:1.75rem 0;">
      <button id="btnLoadMoreTop" class="btn-ghost">Load More</button>
    </div>
  `;



  try {
    const res = await fetchApi(`/tokens/top?chain=${state.chain}&page=1&limit=${state.limit}`);
    document.getElementById('topTableBody').innerHTML = renderTokenRows(res.tokens);

    const btnMore = document.getElementById('btnLoadMoreTop');
    if (!res.tokens || res.tokens.length < state.limit) {
      if (btnMore) btnMore.style.display = 'none';
    }
    if (btnMore) {
      btnMore.onclick = async () => {
        btnMore.disabled = true;
        btnMore.textContent = 'Loading more…';
        try {
          state.page++;
          const nextRes = await fetchApi(`/tokens/top?chain=${state.chain}&page=${state.page}&limit=${state.limit}`);
          const newTokens = nextRes.tokens || [];
          if (newTokens.length > 0) {
            document.getElementById('topTableBody').insertAdjacentHTML('beforeend', renderTokenRows(newTokens));
          }
          if (newTokens.length < state.limit) {
            btnMore.style.display = 'none';
          } else {
            btnMore.disabled = false;
            btnMore.textContent = 'Load More';
          }
        } catch (e) {
          btnMore.style.display = 'none';
        }
      };
    }
  } catch (err) {
    document.getElementById('topTableBody').innerHTML = `<tr><td colspan="12" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 3. NEW COINS VIEW (/new-coins) ---------------- */

async function renderNewCoins() {
  state.page = 1;

  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">New Coins & Recent Listings</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Discover recently listed and newly submitted verified tokens ordered by listing timestamp.</p>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>6h</th><th>TXN</th><th>LP</th>
            <th>24h Volume</th><th>Market Cap</th><th>Socials</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="newTableBody">
          <tr><td colspan="14" class="state-msg">Loading New Coins…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-wrap" id="newPagination" style="text-align:center;margin:1.75rem 0;">
      <button id="btnLoadMoreNew" class="btn-ghost">Load More</button>
    </div>
  `;



  try {
    const res = await fetchApi(`/tokens/new?chain=${state.chain}&page=1&limit=${state.limit}`);
    document.getElementById('newTableBody').innerHTML = renderTokenRows(res.tokens, { showAge: true });

    const btnMore = document.getElementById('btnLoadMoreNew');
    if (!res.tokens || res.tokens.length < state.limit) {
      if (btnMore) btnMore.style.display = 'none';
    }
    if (btnMore) {
      btnMore.onclick = async () => {
        btnMore.disabled = true;
        btnMore.textContent = 'Loading more…';
        try {
          state.page++;
          const nextRes = await fetchApi(`/tokens/new?chain=${state.chain}&page=${state.page}&limit=${state.limit}`);
          const newTokens = nextRes.tokens || [];
          if (newTokens.length > 0) {
            document.getElementById('newTableBody').insertAdjacentHTML('beforeend', renderTokenRows(newTokens, { showAge: true }));
          }
          if (newTokens.length < state.limit) {
            btnMore.style.display = 'none';
          } else {
            btnMore.disabled = false;
            btnMore.textContent = 'Load More';
          }
        } catch (e) {
          btnMore.style.display = 'none';
        }
      };
    }
  } catch (err) {
    document.getElementById('newTableBody').innerHTML = `<tr><td colspan="12" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 4. HOT COINS VIEW (/hot) ---------------- */

async function renderHotCoins() {
  state.page = 1;

  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Hot Coins Radar</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Ranked algorithmically by the Bulls Traking Hot Score (combining volume, momentum, velocity, and liquidity turnover).</p>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>6h</th><th>TXN</th><th>LP</th>
            <th>24h Volume</th><th>Market Cap</th><th>Socials</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="hotTableBody">
          <tr><td colspan="14" class="state-msg">Loading Hot Coins…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-wrap" id="hotPagination" style="text-align:center;margin:1.75rem 0;">
      <button id="btnLoadMoreHot" class="btn-ghost">Load More</button>
    </div>
  `;



  try {
    const res = await fetchApi(`/tokens/hot?chain=${state.chain}&page=1&limit=${state.limit}`);
    document.getElementById('hotTableBody').innerHTML = renderTokenRows(res.tokens, { showHot: true });

    const btnMore = document.getElementById('btnLoadMoreHot');
    if (!res.tokens || res.tokens.length < state.limit) {
      if (btnMore) btnMore.style.display = 'none';
    }
    if (btnMore) {
      btnMore.onclick = async () => {
        btnMore.disabled = true;
        btnMore.textContent = 'Loading more…';
        try {
          state.page++;
          const nextRes = await fetchApi(`/tokens/hot?chain=${state.chain}&page=${state.page}&limit=${state.limit}`);
          const newTokens = nextRes.tokens || [];
          if (newTokens.length > 0) {
            document.getElementById('hotTableBody').insertAdjacentHTML('beforeend', renderTokenRows(newTokens, { showHot: true }));
          }
          if (newTokens.length < state.limit) {
            btnMore.style.display = 'none';
          } else {
            btnMore.disabled = false;
            btnMore.textContent = 'Load More';
          }
        } catch (e) {
          btnMore.style.display = 'none';
        }
      };
    }
  } catch (err) {
    document.getElementById('hotTableBody').innerHTML = `<tr><td colspan="12" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 5. GAINERS VIEW (/gainers) ---------------- */

async function renderGainers() {
  state.page = 1;

  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Top Gainers (24h)</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Assets with highest 24-hour percentage growth, screened through liquidity and volume quality thresholds.</p>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>6h</th><th>TXN</th><th>LP</th>
            <th>24h Volume</th><th>Market Cap</th><th>Socials</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="gainersTableBody">
          <tr><td colspan="14" class="state-msg">Loading Top Gainers…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-wrap" id="gainersPagination" style="text-align:center;margin:1.75rem 0;">
      <button id="btnLoadMoreGainers" class="btn-ghost">Load More</button>
    </div>
  `;



  try {
    const res = await fetchApi(`/tokens/gainers?chain=${state.chain}&page=1&limit=${state.limit}`);
    document.getElementById('gainersTableBody').innerHTML = renderTokenRows(res.tokens);

    const btnMore = document.getElementById('btnLoadMoreGainers');
    if (!res.tokens || res.tokens.length < state.limit) {
      if (btnMore) btnMore.style.display = 'none';
    }
    if (btnMore) {
      btnMore.onclick = async () => {
        btnMore.disabled = true;
        btnMore.textContent = 'Loading more…';
        try {
          state.page++;
          const nextRes = await fetchApi(`/tokens/gainers?chain=${state.chain}&page=${state.page}&limit=${state.limit}`);
          const newTokens = nextRes.tokens || [];
          if (newTokens.length > 0) {
            document.getElementById('gainersTableBody').insertAdjacentHTML('beforeend', renderTokenRows(newTokens));
          }
          if (newTokens.length < state.limit) {
            btnMore.style.display = 'none';
          } else {
            btnMore.disabled = false;
            btnMore.textContent = 'Load More';
          }
        } catch (e) {
          btnMore.style.display = 'none';
        }
      };
    }
  } catch (err) {
    document.getElementById('gainersTableBody').innerHTML = `<tr><td colspan="12" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 6. PROMOTED VIEW (/promoted) ---------------- */

async function renderPromotedPage() {
  app.innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Promoted Tokens</h1>
        <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Active sponsored partner projects with verified promotion records.</p>
      </div>
      <div>
        <a href="#/promote" class="btn-solid" style="display:inline-flex;align-items:center;gap:6px;">
          <span>★ Promote Your Coin</span>
        </a>
      </div>
    </div>
    <div id="promotedGrid" class="promoted-grid">
      <div class="state-msg">Loading promoted tokens…</div>
    </div>
  `;

  try {
    const res = await fetchApi('/promoted');
    const container = document.getElementById('promotedGrid');

    if (!res.data || res.data.length === 0) {
      container.innerHTML = `<div class="state-msg" style="grid-column:1/-1;">No active promoted tokens at this moment.</div>`;
      return;
    }

    container.innerHTML = res.data.map(renderPromotedCard).join('');

    // Promoted Tokens Table (Task 2d)
    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    tableWrap.style.marginTop = '2rem';
    tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>6h</th><th>TXN</th><th>LP</th>
            <th>24h Volume</th><th>Market Cap</th><th>Socials</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="promotedTableBody">
          ${renderTokenRows(res.data)}
        </tbody>
      </table>
    `;
    app.appendChild(tableWrap);
  } catch (err) {
    document.getElementById('promotedGrid').innerHTML = `<div class="state-msg">Error: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- 6b. PROMOTE COIN VIEW (/promote) ---------------- */

let promoteOrderState = {
  selectedPkg: '7D',
  price: 499,
  days: 7,
  activeOrder: null
};

async function renderPromotePage() {
  document.title = 'Promote Your Token | Bulls Traking';
  promoteOrderState.selectedPkg = '7D';
  promoteOrderState.price = 499;
  promoteOrderState.days = 7;
  promoteOrderState.activeOrder = null;

  app.innerHTML = `
    <div class="promote-container">
      <div class="page-head" style="text-align:center;margin-bottom:2rem;">
        <span style="display:inline-block;background:rgba(245,166,35,0.12);color:var(--gold);border:1px solid rgba(245,166,35,0.3);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-bottom:8px;">★ SPONSORED SPOTLIGHT</span>
        <h1 style="font-family:var(--display);margin:0 0 .5rem;font-size:2rem;">Promote Your Token</h1>
        <p style="color:var(--text-muted);font-size:14px;max-width:620px;margin:0 auto;">
          Get featured at the top of Bulls Traking homepage, drive instant verified 1-click DEX trading volume, and gain spotlight across all chains with automated on-chain verification.
        </p>
      </div>

      <div class="promote-grid-layout">
        <!-- FORM COLUMN -->
        <div class="form-card" style="margin:0;max-width:none;">
          <form id="promoteForm" onsubmit="event.preventDefault(); submitPromotionOrder();">
            <h3 style="margin:0 0 1rem;font-size:1.1rem;color:var(--ink);">1. Token Information</h3>
            
            <div class="field-row">
              <div class="field">
                <label for="pName">Token Name *</label>
                <input type="text" id="pName" placeholder="e.g. Bulls Protocol" required>
              </div>
              <div class="field">
                <label for="pSymbol">Token Symbol *</label>
                <input type="text" id="pSymbol" placeholder="e.g. BULL" required>
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="pChain">Network Chain *</label>
                <select id="pChain" required>
                  <option value="bsc">BNB Chain (BSC)</option>
                  <option value="solana">Solana</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="base">Base</option>
                </select>
              </div>
              <div class="field">
                <label for="pContract">Contract Address (CA) *</label>
                <input type="text" id="pContract" placeholder="Token mint or contract address" required>
              </div>
            </div>

            <div class="field">
              <label for="pLogo">Token Logo URL * <span style="font-size:11px;color:var(--text-faint);font-weight:normal;">(Square 1:1, 256x256 or 512x512 PNG/WebP/SVG)</span></label>
              <input type="url" id="pLogo" placeholder="https://yourdomain.com/logo.png" required>
            </div>

            <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">2. Social Links <span style="font-size:11px;color:var(--text-faint);font-weight:normal;">(Optional — only provided links will display icons)</span></h3>
            
            <div class="field-row">
              <div class="field">
                <label for="pWeb">🌐 Official Website</label>
                <input type="url" id="pWeb" placeholder="https://yourproject.com">
              </div>
              <div class="field">
                <label for="pX">𝕏 / Twitter Handle or URL</label>
                <input type="text" id="pX" placeholder="https://x.com/yourproject">
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="pTg">✈ Telegram Community</label>
                <input type="text" id="pTg" placeholder="https://t.me/yourcommunity">
              </div>
              <div class="field">
                <label for="pReddit">👾 Reddit Community</label>
                <input type="text" id="pReddit" placeholder="https://reddit.com/r/yourproject">
              </div>
            </div>

            <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">3. Select Promotion Package</h3>
            <div class="package-selector" id="pkgSelector">
              <div class="package-card" data-key="1D" data-price="99" data-days="1">
                <div style="font-weight:700;font-size:14px;color:var(--ink);">1 Day</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$99</div>
                <div style="font-size:11px;color:var(--text-muted);">Quick Spotlight</div>
              </div>
              <div class="package-card" data-key="3D" data-price="249" data-days="3">
                <div style="font-weight:700;font-size:14px;color:var(--ink);">3 Days</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$249</div>
                <div style="font-size:11px;color:var(--text-muted);">Weekend Run</div>
              </div>
              <div class="package-card is-selected" data-key="7D" data-price="499" data-days="7">
                <span class="pkg-badge">POPULAR</span>
                <div style="font-weight:700;font-size:14px;color:var(--ink);">7 Days</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$499</div>
                <div style="font-size:11px;color:var(--text-muted);">Full Week Momentum</div>
              </div>
              <div class="package-card" data-key="30D" data-price="1499" data-days="30">
                <span class="pkg-badge" style="background:#00E5FF;">VIP</span>
                <div style="font-weight:700;font-size:14px;color:var(--ink);">30 Days</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$1,499</div>
                <div style="font-size:11px;color:var(--text-muted);">Maximum Dominance</div>
              </div>
            </div>

            <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">4. Payment Method</h3>
            <div style="display:flex;gap:12px;margin-bottom:1.5rem;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
                <input type="radio" name="payMethod" value="direct_onchain" checked>
                <span><b>Direct On-Chain Transfer (USDT / SOL)</b> — Instant Auto-Verification (0% Fee)</span>
              </label>
            </div>

            <button type="submit" id="btnCreateOrder" class="btn-solid" style="width:100%;padding:12px;font-size:15px;cursor:pointer;">
              Continue to Instant Payment ($499 USDT) →
            </button>
          </form>

          <!-- ORDER PAYMENT MODAL / AREA (HIDDEN INITIALLY) -->
          <div id="paymentArea" style="display:none;margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1.5rem;">
            <div style="background:rgba(127,184,120,0.06);border:1px solid rgba(127,184,120,0.25);border-radius:8px;padding:1.25rem;margin-bottom:1rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:12px;color:var(--text-muted);">ORDER #<span id="dispOrderId"></span></span>
                <span style="background:rgba(245,166,35,0.15);color:var(--gold);border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;" id="dispOrderStatus">Awaiting Payment</span>
              </div>
              <div style="font-size:1.4rem;font-weight:800;color:var(--ink);margin-bottom:4px;">
                Send <span style="color:var(--up);" id="dispAmount">$499 USDT</span>
              </div>
              <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">
                Send the exact amount in <b>BEP-20 USDT (BNB Chain)</b> or <b>Solana</b> to the platform treasury address below:
              </p>

              <label style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">Platform Treasury Address:</label>
              <div class="deposit-address-box">
                <span id="dispTreasuryAddr">0x71C568630A7EbC4B2b122E1a22114777d1303b71</span>
                <button type="button" class="copy-btn" id="btnCopyTreasury" onclick="copyTreasuryAddress()">Copy 📋</button>
              </div>

              <!-- TxHash Verification Form -->
              <div style="margin-top:1.25rem;">
                <label for="inputTxHash" style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Paste Transaction Hash (TxHash):</label>
                <div style="display:flex;gap:8px;">
                  <input type="text" id="inputTxHash" placeholder="e.g. 0xabcd1234... or Solana signature" style="flex:1;padding:8px 12px;font-family:monospace;font-size:12px;background:var(--bg);border:1px solid var(--border);color:var(--ink);border-radius:4px;">
                  <button type="button" id="btnVerifyTx" class="btn-solid" onclick="verifyAndActivateOrder()" style="padding:8px 16px;white-space:nowrap;">
                    🚀 Verify & Activate Now
                  </button>
                </div>
                <div id="verifyStatusMsg" style="margin-top:8px;font-size:12px;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- PREVIEW COLUMN -->
        <div>
          <div style="position:sticky;top:20px;">
            <h3 style="margin:0 0 .75rem;font-size:1.05rem;color:var(--ink);">Live Promoted Card Preview</h3>
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 1rem;">This is how your promoted token will look on the homepage.</p>
            
            <div id="previewCardWrap">
              <div class="promoted-card" style="border:1px solid var(--gold);box-shadow:0 0 15px rgba(245,166,35,0.15);">
                <div class="promoted-meta">
                  <img id="prevLogo" class="promoted-logo" src="assets/logo-transparent.png" alt="Preview Logo" onerror="this.onerror=null; this.src='assets/logo-transparent.png';">
                  <div>
                    <div class="promoted-name">
                      <span id="prevName">Token Name</span> <span class="badge-promoted">PROMOTED</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                      <span id="prevChain" style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">BSC</span>
                      <a id="prevTradeBtn" href="#" target="_blank" class="btn-promoted-trade" title="Trade directly on DEX">🚀 Trade ↗</a>
                    </div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="promoted-price">$0.000100</div>
                  <div style="color:var(--up);">+12.4%</div>
                  <div id="prevSocials" style="margin-top:4px;display:flex;justify-content:flex-end;gap:3px;">
                    <span style="color:var(--text-faint);font-size:11px;">—</span>
                  </div>
                </div>
              </div>
            </div>

            <div style="margin-top:1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;">
              <h4 style="margin:0 0 .5rem;font-size:12px;color:var(--ink);">⚡ What You Get:</h4>
              <ul style="margin:0;padding-left:1.2rem;font-size:12px;color:var(--text-muted);line-height:1.6;">
                <li>Top Homepage Carousel Placement</li>
                <li>Exclusive Promoted Spotlight Grid</li>
                <li>1-Click Verified DEX Trading Button</li>
                <li>Live Social Links: Website, 𝕏, Telegram, Reddit</li>
                <li>Instant Automated On-Chain Verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initPromotePreviewHandlers();
}

function initPromotePreviewHandlers() {
  const pName = document.getElementById('pName');
  const pSymbol = document.getElementById('pSymbol');
  const pChain = document.getElementById('pChain');
  const pContract = document.getElementById('pContract');
  const pLogo = document.getElementById('pLogo');
  const pWeb = document.getElementById('pWeb');
  const pX = document.getElementById('pX');
  const pTg = document.getElementById('pTg');
  const pReddit = document.getElementById('pReddit');

  const prevName = document.getElementById('prevName');
  const prevChain = document.getElementById('prevChain');
  const prevLogo = document.getElementById('prevLogo');
  const prevTradeBtn = document.getElementById('prevTradeBtn');
  const prevSocials = document.getElementById('prevSocials');
  const btnCreateOrder = document.getElementById('btnCreateOrder');

  function updatePreview() {
    if (prevName) prevName.textContent = pName.value.trim() ? `${pName.value.trim()} (${(pSymbol.value.trim() || 'PROMO').toUpperCase()})` : 'Token Name';
    if (prevChain) prevChain.textContent = (pChain.value || 'bsc').toUpperCase();
    if (prevLogo && pLogo.value.trim()) prevLogo.src = pLogo.value.trim();

    const ca = pContract.value.trim();
    const ch = pChain.value;
    let tradeUrl = '#';
    let dexLabel = 'Trade';
    if (ca) {
      if (ch === 'solana') { tradeUrl = `https://raydium.io/swap/?outputMint=${ca}`; dexLabel = 'Raydium'; }
      else if (ch === 'bsc') { tradeUrl = `https://pancakeswap.finance/swap?outputCurrency=${ca}`; dexLabel = 'PancakeSwap'; }
      else if (ch === 'ethereum') { tradeUrl = `https://app.uniswap.org/swap?outputCurrency=${ca}&chain=ethereum`; dexLabel = 'Uniswap'; }
      else if (ch === 'base') { tradeUrl = `https://aerodrome.finance/swap?outputCurrency=${ca}`; dexLabel = 'Aerodrome'; }
      else { tradeUrl = `https://dexscreener.com/search?q=${ca}`; }
    }
    if (prevTradeBtn) {
      prevTradeBtn.href = tradeUrl;
      prevTradeBtn.textContent = `🚀 ${dexLabel} ↗`;
    }

    if (prevSocials) {
      prevSocials.innerHTML = renderSocialLinks({
        website_url: pWeb.value.trim() || null,
        x_url: pX.value.trim() || null,
        telegram_url: pTg.value.trim() || null,
        reddit_url: pReddit.value.trim() || null
      });
    }
  }

  [pName, pSymbol, pChain, pContract, pLogo, pWeb, pX, pTg, pReddit].forEach(el => {
    if (el) el.addEventListener('input', updatePreview);
  });

  // Package selector click handler
  const cards = document.querySelectorAll('#pkgSelector .package-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      promoteOrderState.selectedPkg = card.dataset.key;
      promoteOrderState.price = Number(card.dataset.price);
      promoteOrderState.days = Number(card.dataset.days);
      if (btnCreateOrder) {
        btnCreateOrder.textContent = `Continue to Instant Payment ($${promoteOrderState.price} USDT) →`;
      }
      const dispAmount = document.getElementById('dispAmount');
      if (dispAmount) dispAmount.textContent = `$${promoteOrderState.price} USDT`;
    });
  });
}

async function submitPromotionOrder() {
  const btn = document.getElementById('btnCreateOrder');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating Secure Order…';
  }

  try {
    const payload = {
      tokenName: document.getElementById('pName').value.trim(),
      tokenSymbol: document.getElementById('pSymbol').value.trim().toUpperCase(),
      chain: document.getElementById('pChain').value,
      contractAddress: document.getElementById('pContract').value.trim(),
      logoUrl: document.getElementById('pLogo').value.trim(),
      websiteUrl: document.getElementById('pWeb').value.trim() || null,
      xUrl: document.getElementById('pX').value.trim() || null,
      telegramUrl: document.getElementById('pTg').value.trim() || null,
      redditUrl: document.getElementById('pReddit').value.trim() || null,
      packageKey: promoteOrderState.selectedPkg,
      price: promoteOrderState.price,
      durationDays: promoteOrderState.days,
      paymentMethod: 'direct_onchain'
    };

    const res = await fetchApi('/promotions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.orderId) throw new Error(res.error || 'Failed to create order.');

    promoteOrderState.activeOrder = res;
    const paymentArea = document.getElementById('paymentArea');
    if (paymentArea) paymentArea.style.display = 'block';

    document.getElementById('dispOrderId').textContent = res.orderId;
    document.getElementById('dispAmount').textContent = `$${res.price} USDT`;
    
    // Set treasury address based on chain
    const treasuryMap = res.treasuryAddresses || {};
    const chainKey = payload.chain === 'solana' ? 'solana' : 'bsc';
    const chosenTreasury = treasuryMap[chainKey] || treasuryMap.bsc || '0x71C568630A7EbC4B2b122E1a22114777d1303b71';
    document.getElementById('dispTreasuryAddr').textContent = chosenTreasury;

    if (btn) {
      btn.style.display = 'none';
    }

    // Smooth scroll down to payment area
    paymentArea.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Error creating order: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Continue to Instant Payment ($${promoteOrderState.price} USDT) →`;
    }
  }
}

function copyTreasuryAddress() {
  const addr = document.getElementById('dispTreasuryAddr')?.textContent;
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => {
    const btn = document.getElementById('btnCopyTreasury');
    if (btn) {
      btn.textContent = 'Copied! ✓';
      setTimeout(() => { btn.textContent = 'Copy 📋'; }, 2000);
    }
  }).catch(() => {
    prompt('Copy Treasury Address:', addr);
  });
}

async function verifyAndActivateOrder() {
  const txInput = document.getElementById('inputTxHash');
  const btn = document.getElementById('btnVerifyTx');
  const statusMsg = document.getElementById('verifyStatusMsg');
  const order = promoteOrderState.activeOrder;

  if (!order || !order.orderId) {
    alert('No active order found. Please submit token details first.');
    return;
  }

  const txHash = txInput?.value.trim();
  if (!txHash) {
    if (statusMsg) {
      statusMsg.innerHTML = '<span style="color:var(--down);">Please paste your transaction hash (TxHash) first.</span>';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying on Blockchain…';
  }
  if (statusMsg) {
    statusMsg.innerHTML = '<span style="color:var(--text-muted);">Querying blockchain RPC for transaction receipt…</span>';
  }

  try {
    const res = await fetchApi('/promotions/verify-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.orderId,
        txHash
      })
    });

    if (res.success) {
      if (statusMsg) {
        statusMsg.innerHTML = `
          <div style="background:rgba(127,184,120,0.15);color:var(--up);padding:10px 14px;border-radius:6px;border:1px solid rgba(127,184,120,0.3);margin-top:10px;">
            <b>🎉 Payment Verified!</b> Your promotion is now <b>LIVE</b> on Bulls Traking.<br>
            Redirecting to Promoted section in 2 seconds…
          </div>
        `;
      }
      const dispStatus = document.getElementById('dispOrderStatus');
      if (dispStatus) {
        dispStatus.textContent = 'ACTIVE / LIVE';
        dispStatus.style.background = 'rgba(127,184,120,0.2)';
        dispStatus.style.color = 'var(--up)';
      }

      setTimeout(() => {
        location.hash = '#/promoted';
      }, 2200);
    } else {
      throw new Error(res.error || 'Verification failed');
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.innerHTML = `<div style="color:var(--down);margin-top:6px;"><b>Verification Notice:</b> ${escapeHtml(err.message)}</div>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Verify & Activate Now';
    }
  }
}

/* ---------------- 7a. CONTRACT SCANNER VIEW (/scan) (Phase 2 Task 1) ---------------- */

function renderScanner() {
  app.innerHTML = `
    <div class="form-card" id="scannerCard">
      <div class="page-head" style="text-align:center;margin-bottom:1.5rem;">
        <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.6rem;">Contract Security Scanner</h1>
        <p style="color:var(--text-muted);font-size:13px;margin:0;">Instant on-chain security audit, honeypot detection, tax analysis, and risk scoring powered by GoPlus.</p>
      </div>

      <form id="scannerForm">
        <div class="field">
          <label>Blockchain Network *</label>
          <select id="scanChain" name="chain" required>
            <option value="binance-smart-chain" selected>BNB Smart Chain (BSC)</option>
            <option value="ethereum-ecosystem">Ethereum (ETH)</option>
            <option value="base-ecosystem">Base</option>
            <option value="solana-ecosystem">Solana (SOL)</option>
          </select>
        </div>

        <div class="field">
          <label>Token Contract Address *</label>
          <input type="text" id="scanAddress" name="address" placeholder="0x... or Solana Mint Address" required>
        </div>

        <button type="submit" class="submit-btn" id="btnScan">Scan Contract</button>
      </form>

      <div id="scanResult"></div>
    </div>
  `;

  const form = document.getElementById('scannerForm');
  const btn = document.getElementById('btnScan');
  const resultContainer = document.getElementById('scanResult');

  // Auto-populate from New Pairs Radar or other views
  const storedAddr = sessionStorage.getItem('scan_address');
  const storedChain = sessionStorage.getItem('scan_chain');
  if (storedAddr) {
    const inputAddr = document.getElementById('scanAddress');
    const selectChain = document.getElementById('scanChain');
    if (inputAddr) inputAddr.value = storedAddr;
    if (selectChain && storedChain) selectChain.value = storedChain;
    sessionStorage.removeItem('scan_address');
    sessionStorage.removeItem('scan_chain');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chain = document.getElementById('scanChain').value;
    const address = document.getElementById('scanAddress').value.trim();
    if (!address) return;

    btn.disabled = true;
    btn.textContent = 'Scanning on-chain…';
    resultContainer.innerHTML = `<div class="state-msg"><span class="live-pulse"></span> Performing deep contract audit…</div>`;

    try {
      const res = await fetchApi('/security/scan?chain=' + chain + '&address=' + encodeURIComponent(address));
      const scan = res.data;

      const isCritical = scan.honeypot === 1 || scan.risk_level === 'CRITICAL' || scan.risk_level === 'HIGH';
      const isWarn = !isCritical && (scan.risk_level === 'MEDIUM' || scan.mintable === 1 || (scan.buy_tax || 0) > 10 || (scan.sell_tax || 0) > 10 || scan.blacklist === 1);
      
      const summaryClass = isCritical ? 'danger' : isWarn ? 'warn' : 'safe';
      const summaryTitle = isCritical ? 'High / Critical Risk' : isWarn ? 'Medium Risk / Warning' : 'Safe / Low Risk';

      resultContainer.innerHTML = `
        <div class="risk-summary ${summaryClass}">
          <div>
            <div class="risk-badge-title">${summaryTitle}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
              ${isCritical ? 'Critical security vulnerabilities detected. Exercise extreme caution.' : isWarn ? 'Minor risk flags identified. Check taxes and ownership permissions.' : 'No critical contract risks or malicious routines detected.'}
            </div>
          </div>
          <div class="risk-score-pill">
            Score: ${scan.risk_score != null ? scan.risk_score : 95}/100
          </div>
        </div>

        <div class="check-grid">
          <div class="check-item ${scan.honeypot ? 'fail' : 'pass'}">
            <div class="label">Honeypot</div>
            <div class="val">${scan.honeypot ? 'FAIL (Honeypot)' : 'PASS (Safe)'}</div>
          </div>
          <div class="check-item ${(scan.buy_tax || 0) > 10 ? 'warn' : 'pass'}">
            <div class="label">Buy Tax</div>
            <div class="val">${(scan.buy_tax ?? 0).toFixed(1)}%</div>
          </div>
          <div class="check-item ${(scan.sell_tax || 0) > 10 ? 'warn' : 'pass'}">
            <div class="label">Sell Tax</div>
            <div class="val">${(scan.sell_tax ?? 0).toFixed(1)}%</div>
          </div>
          <div class="check-item ${scan.mintable ? 'warn' : 'pass'}">
            <div class="label">Mintable</div>
            <div class="val">${scan.mintable ? 'Yes (Can Mint)' : 'No (Capped)'}</div>
          </div>
          <div class="check-item ${scan.ownership === 'renounced' ? 'pass' : 'warn'}">
            <div class="label">Ownership</div>
            <div class="val">${scan.ownership === 'renounced' ? 'Renounced' : 'Active Owner'}</div>
          </div>
          <div class="check-item ${scan.blacklist ? 'fail' : 'pass'}">
            <div class="label">Blacklist</div>
            <div class="val">${scan.blacklist ? 'Yes (Blacklistable)' : 'No (Unrestricted)'}</div>
          </div>
          <div class="check-item ${scan.proxy ? 'warn' : 'pass'}">
            <div class="label">Proxy</div>
            <div class="val">${scan.proxy ? 'Yes (Upgradeable)' : 'No (Immutable)'}</div>
          </div>
          <div class="check-item pass">
            <div class="label">Audit Status</div>
            <div class="val">${scan.fromCache ? 'Cached (24h)' : 'Live Scan'}</div>
          </div>
        </div>
      `;
    } catch (err) {
      resultContainer.innerHTML = `<div class="state-msg" style="color:var(--rose);">Scan Failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Scan Contract';
    }
  });
}

/* ---------------- 7. PRESALES VIEW (Section 3 Placeholder) ---------------- */

function renderPresales() {
  app.innerHTML = `
    <div class="placeholder-card">
      <h2>Presale Radar</h2>
      <p>Presale tracking is coming soon.</p>
    </div>
  `;
}

/* ---------------- 8. SUBMIT TOKEN VIEW (Section 11, 12, 45) ---------------- */

function renderSubmit() {
  app.innerHTML = `
    <div class="form-card" id="submitFormCard">
      <div class="page-head" style="text-align:center;margin-bottom:1.5rem;">
        <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.6rem;">Submit Token</h1>
        <p style="color:var(--text-muted);font-size:13px;margin:0;">List your token on Bulls Traking. Verified submissions automatically appear in New Coins.</p>
      </div>

      <form id="tokenSubmitForm">
        <div class="field-row">
          <div class="field">
            <label>Ecosystem / Chain *</label>
            <select name="chain" required>
              <option value="solana-ecosystem">Solana</option>
              <option value="ethereum-ecosystem">Ethereum</option>
              <option value="binance-smart-chain">BNB Chain</option>
              <option value="base-ecosystem">Base</option>
            </select>
          </div>
          <div class="field">
            <label>Project Name *</label>
            <input type="text" name="projectName" placeholder="e.g. Bulls Traking Alpha" required>
          </div>
        </div>

        <div class="field">
          <label>Contract Address *</label>
          <input type="text" name="contractAddress" placeholder="0x... or Solana Mint Address" required>
          <div class="field-help">Chain + Contract Address must be unique.</div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Contact Email (Optional)</label>
            <input type="email" name="projectEmail" placeholder="team@project.xyz">
          </div>
          <div class="field">
            <label>Logo Image URL (Optional)</label>
            <input type="url" name="logoUrl" placeholder="https://.../logo.png">
          </div>
        </div>

        <!-- 3 SOCIAL LINKS RESTRICTION -->
        <div class="field">
          <label>Website URL</label>
          <input type="url" name="websiteUrl" placeholder="https://project.xyz">
        </div>
        <div class="field-row">
          <div class="field">
            <label>X / Twitter URL</label>
            <input type="url" name="xUrl" placeholder="https://x.com/project">
          </div>
          <div class="field">
            <label>Telegram Community URL</label>
            <input type="url" name="telegramUrl" placeholder="https://t.me/project">
          </div>
        </div>

        <div class="field">
          <label>Project Description</label>
          <textarea name="description" rows="3" placeholder="Describe the token utilities and roadmap..."></textarea>
        </div>

        <button type="submit" class="submit-btn" id="submitBtn">Submit Token</button>
      </form>
    </div>

    <!-- SUCCESS SCREEN CONTAINER (Section 12) -->
    <div id="successScreenContainer" style="display:none;"></div>
  `;

  const form = document.getElementById('tokenSubmitForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Validating & Processing…';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetchApi('/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      // Section 12 Success Screen
      document.getElementById('submitFormCard').style.display = 'none';
      const container = document.getElementById('successScreenContainer');
      container.style.display = 'block';
      container.innerHTML = `
        <div class="success-screen-card">
          <h2>Token Submitted Successfully</h2>
          <p>
            Your token has been successfully processed and is now live on <b>Bulls Traking</b>.<br>
            It will appear in New Coins and token discovery sections.
          </p>
          <div>
            <a href="#/token/${res.tokenId}" class="btn-solid" style="padding:.7rem 1.8rem;font-size:14px;">View Token ↗</a>
            <a href="#/new-coins" style="margin-left:12px;color:var(--cyan);font-size:13px;">View in New Coins →</a>
          </div>
        </div>
      `;
    } catch (err) {
      alert('Submission error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Submit Token';
    }
  });
}

/* ---------------- 9. TOKEN DETAIL VIEW (Section 23) ---------------- */

async function renderTokenDetail(idOrAddress) {
  app.innerHTML = `<div class="state-msg">Loading token telemetry…</div>`;

  try {
    const res = await fetchApi(`/tokens/${idOrAddress}`);
    const t = res.data;

    const socials = [];
    if (t.website_url) socials.push(`<a href="${escapeHtml(t.website_url)}" target="_blank" rel="noopener">Website</a>`);
    if (t.x_url) socials.push(`<a href="${escapeHtml(t.x_url)}" target="_blank" rel="noopener">X (Twitter)</a>`);
    if (t.telegram_url) socials.push(`<a href="${escapeHtml(t.telegram_url)}" target="_blank" rel="noopener">Telegram</a>`);

    // Dynamic SEO
    document.title = `${t.name} ($${t.symbol}) Price, Market Cap & Data | Bulls Traking`;

    app.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <a href="#/" style="color:var(--text-faint);font-size:12.5px;">← Back to Toplist</a>
      </div>

      <div class="detail-head">
        <img src="${escapeHtml(normalizeTokenLogo(t.logo_url, t.symbol, t.name))}" alt="${escapeHtml(t.symbol)}" class="token-detail-logo" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(t.symbol)}', '${escapeHtml(t.name)}');">
        <div>
          <h1>
            ${escapeHtml(t.name)} <span class="sym">$${escapeHtml(t.symbol)}</span>
            <button class="watch-star detail-star ${isWatchlisted(t.id) ? 'is-active' : ''}" data-token-id="${t.id}" title="${isWatchlisted(t.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}" onclick="toggleWatchlist('${t.id}', this)">★</button>
          </h1>
          <div style="font-size:12px;color:var(--text-faint);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>Contract: <code style="color:var(--cyan);">${escapeHtml(t.contract_address)}</code></span>
            <button onclick="navigator.clipboard.writeText('${escapeHtml(t.contract_address)}'); alert('Contract address copied!');" style="background:transparent;border:1px solid var(--line-light);color:var(--text-muted);font-size:11px;padding:2px 6px;border-radius:3px;">Copy</button>
            <span style="text-transform:uppercase;">(${escapeHtml(t.chain.replace('-ecosystem',''))})</span>
          </div>
        </div>
      </div>

      <div class="detail-price">${fmtPrice(t.price)} ${fmtChg(t.change_24h)}</div>

      <div class="detail-grid">
        <div class="stat-box"><div class="label">Market Cap</div><div class="value">${fmtUsd(t.market_cap)}</div></div>
        <div class="stat-box"><div class="label">24h Volume</div><div class="value">${fmtUsd(t.volume_24h)}</div></div>
        <div class="stat-box"><div class="label">Rank</div><div class="value">#${t.market_cap_rank || 'N/A'}</div></div>
        <div class="stat-box"><div class="label">1h Change</div><div class="value">${fmtChg(t.change_1h)}</div></div>
        <div class="stat-box"><div class="label">7d Change</div><div class="value">${fmtChg(t.change_7d)}</div></div>
        <div class="stat-box"><div class="label">Hot Score</div><div class="value" style="color:var(--ember);">${t.hot_score || 'N/A'}</div></div>
      </div>

      <div class="detail-grid">
        <div class="stat-box"><div class="label">All Time High (ATH)</div><div class="value">${fmtPrice(t.ath)}</div></div>
        <div class="stat-box"><div class="label">All Time Low (ATL)</div><div class="value">${fmtPrice(t.atl)}</div></div>
        <div class="stat-box"><div class="label">Circulating Supply</div><div class="value">${t.circulating_supply ? Number(t.circulating_supply).toLocaleString() : 'N/A'}</div></div>
        <div class="stat-box"><div class="label">Total Supply</div><div class="value">${t.total_supply ? Number(t.total_supply).toLocaleString() : 'N/A'}</div></div>
      </div>

      <!-- 7D PRICE CHART -->
      <div class="chart-box">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;">
          <h4 style="margin:0;font-size:13px;color:var(--text-muted);">7-Day Price History</h4>
          <span style="font-size:12px;color:var(--text-faint);">Telemetry Snapshots</span>
        </div>
        <div id="chartWrap" style="height:140px;display:flex;align-items:center;justify-content:center;">
          ${t.price_history && t.price_history.length > 1 ? sparklineSvg(t.price_history.map(h => h.price), (t.change_7d ?? 0) >= 0) : '<span style="color:var(--text-faint);font-size:12px;">Gathering historical price snapshots…</span>'}
        </div>
      </div>

      <div class="detail-links">
        ${socials.join('')}
      </div>

      <div class="desc-box">
        <p>${escapeHtml(t.description || 'No project description provided for this token.')}</p>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div class="state-msg">Token telemetry unavailable: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- search ---------------- */

function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  const doSearch = debounce(async (val) => {
    const q = val.trim();
    if (q.length < 1) {
      results.classList.add('hidden');
      return;
    }

    try {
      const res = await fetchApi(`/search?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.data || res.data.length === 0) {
        results.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--text-faint);">No tokens matching "${escapeHtml(q)}"</div>`;
        results.classList.remove('hidden');
        return;
      }

      results.innerHTML = res.data.map(t => `
        <div class="search-row" onclick="location.hash='#/token/${t.id}'; document.getElementById('searchResults').classList.add('hidden');">
          <img src="${escapeHtml(normalizeTokenLogo(t.logo_url, t.symbol, t.name))}" alt="${escapeHtml(t.symbol)}" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(t.symbol)}', '${escapeHtml(t.name)}');">
          <span style="font-weight:600;">${escapeHtml(t.name)}</span>
          <span class="sym">$${escapeHtml(t.symbol)}</span>
          <span style="margin-left:auto;font-weight:600;">${fmtPrice(t.price)}</span>
        </div>
      `).join('');
      results.classList.remove('hidden');
    } catch (e) {
      results.classList.add('hidden');
    }
  }, 200);

  input.addEventListener('input', (e) => doSearch(e.target.value));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      results.classList.add('hidden');
    }
  });
}

/* ---------------- 3b. NEW PAIRS RADAR VIEW (/new-pairs) (Phase 3 Task 1) ---------------- */

let newPairsState = {
  tab: 'latest', // 'latest' | 'trending' | 'matured'
  chain: 'all',  // 'all' | 'solana' | 'bsc' | 'base' | 'ethereum'
  source: 'all', // 'all' | 'pumpfun' | 'fourmeme' | 'stonkfun' | 'dexscreener'
  page: 1,
  limit: 25
};

let radarAutoRefreshTimer = null;

async function renderNewPairs() {
  document.title = 'New Pairs Radar | Bulls Traking';
  if (newPairsState.tab === 'trending') newPairsState.tab = 'latest';
  app.innerHTML = `
    <div class="page-head" style="margin-bottom:1rem;">
      <h1 style="font-family:var(--display);margin:0;font-size:1.75rem;">New Pairs Radar</h1>
    </div>

    <!-- TABS & CHAIN CONTROLS -->
    <div class="controls-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:1.25rem;">
      <div class="subtabs" id="radarTabs">
        <span class="subtab ${newPairsState.tab === 'latest' ? 'is-active' : ''}" data-tab="latest">Latest (< 24h)</span>
        <span class="subtab ${newPairsState.tab === 'matured' ? 'is-active' : ''}" data-tab="matured">Matured (> 7d)</span>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Chain:</span>
        <div class="radar-filter-group" id="radarChainFilters">
          <span class="filter-pill ${newPairsState.chain === 'all' ? 'is-active' : ''}" data-chain="all">All Chains</span>
          <span class="filter-pill ${newPairsState.chain === 'solana' ? 'is-active' : ''}" data-chain="solana">Solana</span>
          <span class="filter-pill ${newPairsState.chain === 'bsc' ? 'is-active' : ''}" data-chain="bsc">BNB Chain</span>
          <span class="filter-pill ${newPairsState.chain === 'base' ? 'is-active' : ''}" data-chain="base">Base</span>
          <span class="filter-pill ${newPairsState.chain === 'ethereum' ? 'is-active' : ''}" data-chain="ethereum">Ethereum</span>
        </div>
      </div>
    </div>

    <!-- PAIRS TABLE -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Token / Pool</th>
            <th>Price</th>
            <th>Liquidity</th>
            <th>24h Volume</th>
            <th>24h TXN</th>
            <th>Pair Age</th>
            <th>Ecosystem</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="radarTableBody">
          <tr><td colspan="9" class="state-msg">Scanning on-chain pairs radar…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-wrap" id="radarPagination" style="text-align:center;margin:1.75rem 0;">
      <button id="btnLoadMoreRadar" class="btn-ghost">Load More</button>
    </div>
  `;

  document.getElementById('radarTabs').addEventListener('click', (e) => {
    const tabEl = e.target.closest('.subtab');
    if (!tabEl) return;
    newPairsState.tab = tabEl.dataset.tab;
    newPairsState.page = 1;
    renderNewPairs();
  });

  document.getElementById('radarChainFilters')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    newPairsState.chain = pill.dataset.chain;
    newPairsState.page = 1;
    renderNewPairs();
  });

  const btnRefresh = document.getElementById('btnRefreshRadar');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      newPairsState.page = 1;
      loadRadarPairs(false, true);
    });
  }

  loadRadarPairs(false);

  // Set auto-refresh interval (every 4 seconds) to pull newly minted tokens live
  if (radarAutoRefreshTimer) clearInterval(radarAutoRefreshTimer);
  radarAutoRefreshTimer = setInterval(() => {
    const { path } = parseHash();
    if (path !== '/new-pairs') {
      clearInterval(radarAutoRefreshTimer);
      radarAutoRefreshTimer = null;
      return;
    }
    if (newPairsState.page === 1) {
      loadRadarPairs(true);
    }
  }, 4000);
}

const SOURCE_MAP = {
  'pumpfun': {
    name: 'Pump.fun',
    badge: 'assets/sources/pumpfun.png',
    getPoolUrl: (p) => `https://pump.fun/coin/${p.token_address}`
  },
  'fourmeme': {
    name: 'four.meme',
    badge: 'assets/sources/fourmeme.png',
    getPoolUrl: (p) => `https://four.meme/token/${p.token_address}`
  },
  'stonkfun': {
    name: 'StonkFun',
    badge: 'assets/sources/stonkfun.svg',
    getPoolUrl: (p) => `https://www.stonkfun.xyz/token/${p.token_address}`
  },
  'dexscreener': {
    name: 'DexScreener',
    badge: 'assets/dexscreener.png',
    getPoolUrl: (p, dsChain) => `https://dexscreener.com/${dsChain}/${p.pair_address}`
  }
};

function renderSingleRadarRow(p, idx = 0, isNew = false) {
  const chainLabel = (p.chain || '').replace('-ecosystem', '').replace('binance-smart-chain', 'BSC').toUpperCase();
  const age = fmtAge(p.pair_created_at);
  const txns = p.txn_count_24h != null && p.txn_count_24h > 0 ? Number(p.txn_count_24h).toLocaleString() : '—';
  
  const dsChain = (p.chain === 'solana-ecosystem' || p.chain === 'solana') ? 'solana' : (p.chain === 'binance-smart-chain' || p.chain === 'bsc') ? 'bsc' : (p.chain === 'ethereum-ecosystem' || p.chain === 'ethereum') ? 'ethereum' : 'base';
  
  const sourceKey = (p.source || 'dexscreener').toLowerCase();
  const sourceCfg = SOURCE_MAP[sourceKey] || SOURCE_MAP['dexscreener'];
  const badgeImg = sourceCfg.badge ? `<img src="${sourceCfg.badge}" alt="${sourceCfg.name}" title="Discovered via ${sourceCfg.name}" class="source-badge">` : '';
  const poolUrl = sourceCfg.getPoolUrl ? sourceCfg.getPoolUrl(p, dsChain) : `https://dexscreener.com/${dsChain}/${p.pair_address}`;

  const isVeryFresh = p.pair_created_at && (Date.now() - new Date(p.pair_created_at).getTime() < 60000);
  const freshBadge = isVeryFresh ? `<span class="badge-fresh-new">NEW</span>` : '';
  const rowClass = isNew ? 'row-new-pair' : '';
  const pairId = p.pair_address || p.token_address;

  return `
    <tr data-pair-id="${escapeHtml(pairId)}" class="${rowClass}">
      <td>${idx + 1}</td>
      <td>
        <div class="token-cell">
          <img src="${escapeHtml(normalizeTokenLogo(p.logo_url, p.symbol, p.name))}" alt="${escapeHtml(p.symbol)}" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(p.symbol)}', '${escapeHtml(p.name)}');">
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="token-name">${escapeHtml(p.name)}</span>
              ${badgeImg}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              <span class="token-sym">${escapeHtml(p.symbol)}</span>
              ${p.twitter_url ? `<a href="${escapeHtml(p.twitter_url)}" target="_blank" rel="noopener" class="token-social-link" title="Twitter / X">𝕏</a>` : ''}
              ${p.telegram_url ? `<a href="${escapeHtml(p.telegram_url)}" target="_blank" rel="noopener" class="token-social-link" title="Telegram">✈</a>` : ''}
              ${p.website_url ? `<a href="${escapeHtml(p.website_url)}" target="_blank" rel="noopener" class="token-social-link" title="Website">🌐</a>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td><b>${fmtPrice(p.price)}</b></td>
      <td>${fmtUsd(p.liquidity)}</td>
      <td>${fmtUsd(p.volume_24h)}</td>
      <td>${txns}</td>
      <td><span class="pair-age-pill">${age}</span>${freshBadge}</td>
      <td><span class="chain-badge chain-${escapeHtml(p.chain || '')}">${chainLabel}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <a href="#/scan" onclick="sessionStorage.setItem('scan_address', '${escapeHtml(p.token_address)}'); sessionStorage.setItem('scan_chain', '${escapeHtml(p.chain)}');" class="btn-ghost" style="padding:2px 8px;font-size:11px;">Scan</a>
          <a href="${poolUrl}" target="_blank" rel="noopener" class="btn-ghost" style="padding:3px 8px;font-size:11px;text-decoration:none;">View Pool ↗</a>
          <button class="btn-copy-address" data-address="${escapeHtml(p.token_address || p.pair_address)}" title="Copy Contract Address" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;padding:2px 4px;">📋</button>
        </div>
      </td>
    </tr>
  `;
}

function renderRadarRows(pairs, startIdx = 0) {
  if (!pairs || pairs.length === 0) {
    return `<tr><td colspan="9" class="state-msg">No newly discovered pairs in this classification.</td></tr>`;
  }
  return pairs.map((p, idx) => renderSingleRadarRow(p, startIdx + idx, false)).join('');
}

async function loadRadarPairs(silent = false, isManual = false) {
  const tbody = document.getElementById('radarTableBody');
  const btnMore = document.getElementById('btnLoadMoreRadar');
  if (!tbody) return;

  if (!silent) {
    tbody.innerHTML = `<tr><td colspan="9" class="state-msg">Scanning on-chain pairs radar…</td></tr>`;
  }

  try {
    const refreshParam = isManual ? '&refresh=1' : '';
    const res = await fetchApi(`/new-pairs?tab=${newPairsState.tab}&chain=${newPairsState.chain}&page=${newPairsState.page}&limit=${newPairsState.limit}${refreshParam}`);
    const pairs = res.pairs || [];

    if (silent && tbody.children.length > 0 && pairs.length > 0) {
      const currentFirstId = tbody.firstElementChild?.dataset?.pairId;
      const newFirstId = pairs[0].pair_address || pairs[0].token_address;

      if (currentFirstId && currentFirstId !== newFirstId) {
        // Collect existing IDs to identify truly new pairs
        const existingIds = new Set(Array.from(tbody.querySelectorAll('tr[data-pair-id]')).map(r => r.dataset.pairId));
        tbody.innerHTML = pairs.map((p, idx) => {
          const id = p.pair_address || p.token_address;
          const isFresh = !existingIds.has(id);
          return renderSingleRadarRow(p, idx, isFresh);
        }).join('');

        const feedbackEl = document.getElementById('radarLiveFeedback');
        if (feedbackEl) {
          feedbackEl.innerHTML = `<span style="color:#00e699;font-weight:700;">⚡ Updated with newly discovered pairs!</span>`;
          setTimeout(() => {
            if (feedbackEl) feedbackEl.textContent = '⚡ Streaming On-Chain Feeds • Auto-Syncing';
          }, 3000);
        }
      } else {
        tbody.innerHTML = renderRadarRows(pairs, 0);
      }
    } else {
      tbody.innerHTML = renderRadarRows(pairs, 0);
    }

    if (pairs.length < newPairsState.limit) {
      if (btnMore) btnMore.style.display = 'none';
    } else {
      if (btnMore) {
        btnMore.style.display = 'inline-block';
        btnMore.onclick = async () => {
          btnMore.disabled = true;
          btnMore.textContent = 'Loading more pairs…';
          try {
            newPairsState.page++;
            const nextRes = await fetchApi(`/new-pairs?tab=${newPairsState.tab}&chain=${newPairsState.chain}&page=${newPairsState.page}&limit=${newPairsState.limit}`);
            const nextPairs = nextRes.pairs || [];
            if (nextPairs.length > 0) {
              const startIdx = (newPairsState.page - 1) * newPairsState.limit;
              tbody.insertAdjacentHTML('beforeend', nextPairs.map((p, idx) => renderSingleRadarRow(p, startIdx + idx, false)).join(''));
            }
            if (nextPairs.length < newPairsState.limit) {
              btnMore.style.display = 'none';
            } else {
              btnMore.disabled = false;
              btnMore.textContent = 'Load More';
            }
          } catch (e) {
            btnMore.style.display = 'none';
          }
        };
      }
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="state-msg">Radar telemetry temporarily unavailable: ${escapeHtml(err.message)}</td></tr>`;
    if (btnMore) btnMore.style.display = 'none';
  }
}

/**
 * Real-Time WebSocket handler for incoming new token pair launches
 */
function handleLiveNewPair(p) {
  if (!p) return;
  const { path } = parseHash();
  if (path !== '/new-pairs') return;
  if (newPairsState.page !== 1) return;
  if (newPairsState.tab !== 'latest') return;

  // Check chain filter
  if (newPairsState.chain !== 'all') {
    const pairChain = (p.chain || '').replace('-ecosystem', '').replace('binance-smart-chain', 'bsc');
    const filterChain = newPairsState.chain.replace('-ecosystem', '').replace('binance-smart-chain', 'bsc');
    if (pairChain !== filterChain) return;
  }

  const tbody = document.getElementById('radarTableBody');
  if (!tbody) return;

  const pairId = p.pair_address || p.token_address;
  if (tbody.querySelector(`tr[data-pair-id="${pairId}"]`)) return;

  // Clear empty state message if present
  const emptyRow = tbody.querySelector('.state-msg');
  if (emptyRow) tbody.innerHTML = '';

  // Render and prepend new row with glowing animation
  const rowHtml = renderSingleRadarRow(p, 0, true);
  tbody.insertAdjacentHTML('afterbegin', rowHtml);

  // Keep table rows limited
  while (tbody.children.length > (newPairsState.limit || 25)) {
    tbody.removeChild(tbody.lastElementChild);
  }

  // Re-number rank column (1..N)
  Array.from(tbody.children).forEach((tr, i) => {
    const firstCell = tr.firstElementChild;
    if (firstCell) firstCell.textContent = i + 1;
  });

  // Flash header feedback
  const feedbackEl = document.getElementById('radarLiveFeedback');
  if (feedbackEl) {
    const srcCfg = SOURCE_MAP[(p.source || '').toLowerCase()] || { name: p.source || 'On-Chain' };
    feedbackEl.innerHTML = `<span style="color:#00e699;font-weight:700;">⚡ Live catch: ${escapeHtml(p.symbol || p.name)} on ${srcCfg.name}!</span>`;
    setTimeout(() => {
      if (feedbackEl) feedbackEl.textContent = '⚡ Streaming On-Chain Feeds • Auto-Syncing';
    }, 3500);
  }
}

/* ---------------- 3c. LOCAL WATCHLIST VIEW (/watchlist) (Phase 3 Task 2) ---------------- */

async function renderWatchlistPage() {
  document.title = 'My Watchlist | Bulls Traking';
  const ids = getWatchlist();

  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">My Watchlist</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Real-time token watchlist stored locally in your browser. Track price moves, liquidity, and 24h volumes.</p>
    </div>
    <div id="watchlistContainer"></div>
  `;

  const container = document.getElementById('watchlistContainer');

  if (!ids || ids.length === 0) {
    container.innerHTML = `
      <div class="watchlist-empty">
        <div class="star-icon">★</div>
        <h2>Your Watchlist is Empty</h2>
        <p>
          You haven't starred any tokens yet.<br>
          Click the star icon (★) on any token row or token page to monitor it here.
        </p>
        <a href="#/top-coins" class="btn-solid" style="padding:.7rem 1.75rem;display:inline-block;">Explore Top Coins</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>Rank</th>
            <th>Token</th>
            <th>Price</th>
            <th>1h</th>
            <th>24h</th>
            <th>7d</th>
            <th>6h</th>
            <th>TXN</th>
            <th>LP</th>
            <th>24h Volume</th>
            <th>Market Cap</th>
            <th>Socials</th>
            <th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="watchlistTableBody">
          <tr><td colspan="14" class="state-msg">Loading watchlisted tokens…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const res = await fetchApi(`/tokens/by-ids?ids=${ids.join(',')}`);
    const tokens = res.tokens || [];
    if (tokens.length === 0) {
      container.innerHTML = `
        <div class="watchlist-empty">
          <div class="star-icon">★</div>
          <h2>No Active Tokens in Watchlist</h2>
          <p>The tokens in your watchlist could not be retrieved or have been archived.</p>
          <a href="#/top-coins" class="btn-solid">Explore Top Coins</a>
        </div>
      `;
      return;
    }

    document.getElementById('watchlistTableBody').innerHTML = renderTokenRows(tokens);
  } catch (err) {
    document.getElementById('watchlistTableBody').innerHTML = `
      <tr><td colspan="13" class="state-msg">Failed to load watchlist: ${escapeHtml(err.message)}</td></tr>
    `;
  }
}


/* ---------------- 10. LEGAL & INFO PAGES (Phase 3 Task 4) ---------------- */

const LEGAL_DISCLAIMER_NOTICE = `
  <div class="legal-disclaimer-box">
    <b>Legal Review Disclaimer:</b> This document is an initial operational placeholder provided for platform structure demonstration. Prior to production launch in regulated jurisdictions, this agreement must undergo formal review by qualified digital asset and securities legal counsel.
  </div>
`;

function renderAbout() {
  document.title = 'About Us | Bulls Traking';
  app.innerHTML = `
    <div class="legal-container">
      ${LEGAL_DISCLAIMER_NOTICE}
      <h1>About Bulls Traking</h1>
      <div class="legal-updated">Last Updated: September 2026</div>

      <h2>1. Platform Mission</h2>
      <p>Bulls Traking is an independent, high-performance crypto token discovery, real-time analytics, trending and listing platform. Our mission is to provide cryptocurrency traders, liquidity providers, and web3 enthusiasts with transparent, unbiased market intelligence across Solana, Ethereum, BNB Chain, and Base.</p>

      <h2>2. What We Provide</h2>
      <ul>
        <li><b>Real-Time Market Telemetry:</b> Sub-second streaming prices, market capitalizations, 24h volumes, and liquidity metrics via CoinMarketCap, CoinGecko, and decentralized automated market makers (AMMs).</li>
        <li><b>New Pairs Radar:</b> Comprehensive profiling radar tracking newly created liquidity pools and fair launches across decentralized exchanges.</li>
        <li><b>Automated Security Auditing:</b> Deep contract analysis powered by GoPlus, identifying honeypots, malicious mint functions, excessive taxes, and blacklist mechanisms.</li>
        <li><b>Alpha & Telegram Signals:</b> Curated market intelligence and sentiment setups aggregated from vetted decentralized communities.</li>
      </ul>

      <h2>3. Independent Operation</h2>
      <p>Bulls Traking is built from the ground up with proprietary indexing and database structures. We do not copy proprietary assets from any existing website and remain committed to fostering an open, transparent decentralized ecosystem.</p>
    </div>
  `;
}

function renderTerms() {
  document.title = 'Terms of Service | Bulls Traking';
  app.innerHTML = `
    <div class="legal-container">
      ${LEGAL_DISCLAIMER_NOTICE}
      <h1>Terms of Service</h1>
      <div class="legal-updated">Last Updated: September 2026</div>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using the Bulls Traking platform ("Bulls Traking", "we", "us", or "our"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, you must immediately cease accessing the platform.</p>

      <h2>2. Description of Services</h2>
      <p>Bulls Traking provides digital asset information, price tracking, community token submissions, security audits, and promotional placements. Bulls Traking is not a broker, exchange, custodian, investment adviser, or financial planner.</p>

      <h2>3. Token Submissions & Listing Rules</h2>
      <p>Users submitting tokens represent and warrant that the information provided is accurate, non-infringing, and does not promote illegal schemes, rug pulls, or fraudulent solicitations. Bulls Traking reserves the right to unlist, flag, or restrict any token or submission at its sole discretion without notice.</p>

      <h2>4. Limitation of Liability</h2>
      <p>To the maximum extent permitted by applicable law, Bulls Traking and its operators shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from your use of the platform, loss of capital, smart contract vulnerabilities, or trading decisions.</p>
    </div>
  `;
}

function renderPrivacy() {
  document.title = 'Privacy Policy | Bulls Traking';
  app.innerHTML = `
    <div class="legal-container">
      ${LEGAL_DISCLAIMER_NOTICE}
      <h1>Privacy Policy</h1>
      <div class="legal-updated">Last Updated: September 2026</div>

      <h2>1. Information We Collect</h2>
      <p>Bulls Traking prioritizes user privacy. We do not require account registration or collect personal identity documents for browsing our public market feeds.</p>
      <ul>
        <li><b>Submission Contact Information:</b> Project owners submitting tokens may provide an optional contact email and social handles.</li>
        <li><b>Technical Analytics:</b> Standard web server logs, IP addresses, and user-agent strings for security mitigation and rate limiting.</li>
        <li><b>Local Device Storage:</b> Client-side data such as your token Watchlist and theme preferences stored strictly on your local browser.</li>
      </ul>

      <h2>2. Third-Party Services</h2>
      <p>Our platform interfaces with reputable public market data providers (e.g. CoinMarketCap, CoinGecko, DexScreener, GoPlus Security). Your interactions with external websites or third-party DEX links are subject to their respective privacy terms.</p>

      <h2>3. Data Retention & Security</h2>
      <p>We maintain industry-standard administrative and cryptographic safeguards to protect submitted metadata from unauthorized access or modification.</p>
    </div>
  `;
}

function renderCookies() {
  document.title = 'Cookie Statement | Bulls Traking';
  app.innerHTML = `
    <div class="legal-container">
      ${LEGAL_DISCLAIMER_NOTICE}
      <h1>Cookie & Local Storage Statement</h1>
      <div class="legal-updated">Last Updated: September 2026</div>

      <h2>1. How We Use Cookies and Local Storage</h2>
      <p>Bulls Traking uses browser <code>localStorage</code> and lightweight session cookies solely to enable core platform features and user preferences.</p>

      <h2>2. Specific Client Storage Items</h2>
      <ul>
        <li><b>bt_watchlist:</b> Stores an array of token IDs you have starred for your personal Watchlist. This information never leaves your device and is not sold or shared with any third party.</li>
        <li><b>scan_address / scan_chain:</b> Temporarily stores contract addresses when navigating between the New Pairs Radar and Contract Scanner.</li>
      </ul>

      <h2>3. Managing Your Storage</h2>
      <p>You can clear your watchlist and local application storage at any time via your browser's Developer Tools or "Clear Browsing Data" settings.</p>
    </div>
  `;
}

function renderDisclaimer() {
  document.title = 'Risk Disclaimer | Bulls Traking';
  app.innerHTML = `
    <div class="legal-container">
      ${LEGAL_DISCLAIMER_NOTICE}
      <h1>Risk & Financial Disclaimer</h1>
      <div class="legal-updated">Last Updated: September 2026</div>

      <h2>1. No Financial Advice</h2>
      <p>None of the content, price data, market rankings, or security risk scores provided on Bulls Traking constitutes financial, legal, investment, or trading advice. All information is provided for general informational and educational purposes only.</p>

      <h2>2. High Volatility & Capital Loss Warning</h2>
      <p>Digital assets, decentralized liquidity pools, and newly minted tokens are subject to extreme market volatility, low liquidity, slippage, and high risk of total loss. You should never invest funds that you cannot afford to lose.</p>

      <h2>3. Independent Due Diligence</h2>
      <p>Prior to interacting with any decentralized smart contract, liquidity pool, or token presale, you must conduct your own independent investigation and verify the underlying contract code on on-chain block explorers.</p>
    </div>
  `;
}

/* ---------------- router ---------------- */

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  return { path, params };
}

function updateNavHighlight(route) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('is-active'));
  const clean = (route === '/' || route === '') ? 'home' : route.replace('/', '');
  const el = document.querySelector(`[data-route="${clean}"]`);
  if (el) el.classList.add('is-active');
}

function route() {
  const { path, params } = parseHash();
  if (params.has('chain')) state.chain = params.get('chain');
  if (params.has('tab')) state.tab = params.get('tab');

  updateNavHighlight(path);

  if (path === '/' || path === '') {
    renderHome();
  } else if (path === '/top-coins') {
    renderTopCoins();
  } else if (path === '/new-pairs') {
    renderNewPairs();
  } else if (path === '/new-coins') {
    renderNewCoins();
  } else if (path === '/hot') {
    renderHotCoins();
  } else if (path === '/gainers') {
    renderGainers();
  } else if (path === '/watchlist') {
    renderWatchlistPage();
  } else if (path === '/scan') {
    renderScanner();
  } else if (path === '/promoted') {
    renderPromotedPage();
  } else if (path === '/promote') {
    renderPromotePage();
  } else if (path === '/presales') {
    renderPresales();
  } else if (path === '/submit') {
    renderSubmit();
  } else if (path === '/about') {
    renderAbout();
  } else if (path === '/terms-of-service' || path === '/terms') {
    renderTerms();
  } else if (path === '/privacy-policy' || path === '/privacy') {
    renderPrivacy();
  } else if (path === '/cookie-statement' || path === '/cookies') {
    renderCookies();
  } else if (path === '/disclaimer') {
    renderDisclaimer();
  } else if (path.startsWith('/token/')) {
    const id = path.replace('/token/', '');
    renderTokenDetail(id);
  } else {
    renderHome();
  }
}

/* ---------------- real-time websocket client ---------------- */

let wsClient = null;
let wsReconnectTimer = null;

function initWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/ws`;

  try {
    wsClient = new WebSocket(wsUrl);

    wsClient.onopen = () => {
      console.log('[WebSocket] Connected to Bulls Traking Real-Time Feed');
      const statusElem = document.getElementById('marketStatus');
      if (statusElem) {
        statusElem.className = 'market-status-indicator';
        statusElem.innerHTML = '<span class="live-pulse"></span> Market Live Stream';
      }
    };

    wsClient.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'PRICE_UPDATE') {
          handleLivePriceUpdate(msg.data);
        } else if (msg.type === 'NEW_PAIR') {
          handleLiveNewPair(msg.data);
        }
      } catch (e) {
        // Non-fatal parse error
      }
    };

    wsClient.onclose = () => {
      const statusElem = document.getElementById('marketStatus');
      if (location.hostname.includes('vercel.app')) {
        if (statusElem) {
          statusElem.className = 'market-status-indicator';
          statusElem.innerHTML = '<span class="live-pulse"></span> Market Data Live';
        }
        return; // Don't infinite-loop reconnect on serverless Vercel
      }
      if (statusElem) {
        statusElem.className = 'market-status-indicator delayed';
        statusElem.textContent = '● Reconnecting Feed…';
      }
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(initWebSocket, 3000);
    };

    wsClient.onerror = () => {
      if (location.hostname.includes('vercel.app')) {
        const statusElem = document.getElementById('marketStatus');
        if (statusElem) {
          statusElem.className = 'market-status-indicator';
          statusElem.innerHTML = '<span class="live-pulse"></span> Market Data Live';
        }
      }
      wsClient.close();
    };
  } catch (err) {
    if (!location.hostname.includes('vercel.app')) {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(initWebSocket, 4000);
    }
  }
}

function handleLivePriceUpdate(data) {
  const { symbol, price, change24h, direction } = data;
  if (!symbol) return;

  // 1. Update Table Rows with visual flash
  const rows = document.querySelectorAll(`tr[data-token-symbol="${symbol}"]`);
  rows.forEach(row => {
    const priceCell = row.querySelector('.cell-price');
    const changeCell = row.querySelector('.cell-change');

    if (priceCell) {
      priceCell.innerHTML = `<b>${fmtPrice(price)}</b>`;
      const flashClass = direction === 'up' ? 'flash-up' : 'flash-down';
      priceCell.classList.remove('flash-up', 'flash-down');
      void priceCell.offsetWidth; // trigger reflow
      priceCell.classList.add(flashClass);
      setTimeout(() => priceCell.classList.remove(flashClass), 1400);
    }

    if (changeCell && change24h != null) {
      changeCell.innerHTML = fmtChg(change24h);
    }
  });

  // 2. Update Ticker Tape items in real-time
  const tickers = document.querySelectorAll(`.tape-item[data-ticker-symbol="${symbol}"]`);
  tickers.forEach(item => {
    const priceSpan = item.querySelector('.ticker-price');
    if (priceSpan) {
      priceSpan.textContent = fmtPrice(price);
    }
  });

  // 3. Update Token Detail Page if open
  const detailPrice = document.querySelector('.detail-price');
  const headSym = document.querySelector('.detail-head .sym');
  if (detailPrice && headSym && headSym.textContent.includes(symbol)) {
    detailPrice.innerHTML = `${fmtPrice(price)} ${fmtChg(change24h)}`;
  }
}

/* ---------------- boot ---------------- */

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  loadTape();
  initSearch();
  initWebSocket();
  route();
});

