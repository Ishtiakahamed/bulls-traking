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
  const diffMs = Date.now() - new Date(d).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
  const w = 90, h = 28;
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

async function loadTape() {
  try {
    const res = await fetchApi('/tokens/trending?limit=12');
    const track = document.getElementById('tapeTrack');
    if (!res.tokens || res.tokens.length === 0) return;

    const items = res.tokens.map((c) => {
      const chg = c.change_24h;
      const cls = chg > 0 ? 'up' : 'down';
      const sign = chg > 0 ? '+' : '';
      return `<span class="tape-item" data-ticker-symbol="${escapeHtml(c.symbol)}"><b>${escapeHtml(c.symbol)}</b><span class="ticker-price">${fmtPrice(c.price)}</span><span class="${cls}">${sign}${(chg ?? 0).toFixed(1)}%</span></span>`;
    });
    track.innerHTML = items.join('') + items.join('');
  } catch (e) {
    document.getElementById('tape').style.display = 'none';
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
  if (t.coingecko_id) {
    return `
      <span class="source-tag cg" title="Verified market telemetry via CoinGecko API">
        <svg class="source-mini-logo" viewBox="0 0 32 32" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#8DC63F"/><path d="M16.5 8C12 8 9 11 9 15.5C9 18 10.2 20.3 12 21.5C11.6 22.4 11.3 23.5 11.5 24.5C11.7 25.1 12.3 25.5 13 25.2C13.9 24.7 14.7 24 15.4 23.1C15.8 23.2 16.1 23.2 16.5 23.2C21 23.2 25 19.7 25 15.5C25 11 21 8 16.5 8ZM13.5 14.2C12.6 14.2 11.9 13.5 11.9 12.6C11.9 11.7 12.6 11 13.5 11C14.4 11 15.1 11.7 15.1 12.6C15.1 13.5 14.4 14.2 13.5 14.2ZM20 19C18.7 20 16.5 20.3 15 19.5C14.6 19.3 14.7 18.6 15.2 18.6C16.4 18.7 18.1 18.5 19.2 17.7C19.7 17.3 20.3 18.5 20 19Z" fill="#1B222C"/><circle cx="13.5" cy="12.6" r="1" fill="#FFFFFF"/></svg>
        <span>CG</span>
      </span>
    `;
  }
  if (t.liquidity > 0 || (t.contract_address && t.contract_address.length > 20)) {
    return `
      <span class="source-tag dex" title="On-chain LP & metrics via DexScreener">
        <svg class="source-mini-logo" viewBox="0 0 32 32" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="16" fill="#131722"/><path d="M7 23.5L15 8.5L18.5 17L24.5 8.5" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <span>DEX</span>
      </span>
    `;
  }
  return `
    <span class="source-tag onchain" title="Verified Bulls Traking Listing">
      <span class="source-mini-logo" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f5a623;"></span>
      <span>Verified</span>
    </span>
  `;
}

function renderSocialLinks(t) {
  const webUrl = t.website_url || (t.coingecko_id ? `https://www.coingecko.com/en/coins/${t.coingecko_id}` : (t.contract_address ? `https://dexscreener.com/search?q=${t.contract_address}` : `#/token/${t.id}`));
  const xUrl = t.x_url || `https://x.com/search?q=${encodeURIComponent('$' + t.symbol)}`;
  const tgUrl = t.telegram_url || `https://t.me/s/${encodeURIComponent(t.symbol.toLowerCase())}`;

  return `
    <div class="social-links-cell" onclick="event.stopPropagation();">
      <a href="${escapeHtml(webUrl)}" target="_blank" rel="noopener noreferrer" class="social-btn web" title="Website / Explorer" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </a>
      <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" class="social-btn x" title="X / Twitter ($${escapeHtml(t.symbol)})" onclick="event.stopPropagation();">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener noreferrer" class="social-btn tg" title="Telegram Community" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
      </a>
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
            <img src="${escapeHtml(t.logo_url || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png')}" alt="${escapeHtml(t.symbol)}" class="token-avatar" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
            <div class="token-meta">
              <div class="token-title-row">
                <span class="token-name">${escapeHtml(t.name)}</span>
                <span class="token-sym">${escapeHtml(t.symbol)}</span>
                ${renderSourceBadge(t)}
                ${isSubmitted ? '<span class="badge-new">NEW</span>' : ''}
                ${showAge && t.age ? `<span class="badge-age">${escapeHtml(t.age)}</span>` : ''}
                ${showHot ? `<span class="badge-hot">🔥 ${t.hot_score}</span>` : ''}
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
    homeState.tab = state.tab || 'trending';

    // Fetch initial home aggregator with 20 items per tab and market stats
    const res = await fetchApi(`/home?chain=${homeState.chain}&limit=20&page=1`);
    const data = res.data;
    state.homeData = data;

    updateMarketStatus(data.marketStats);

    const promotedCards = (data.promoted || []).map(p => `
      <div class="promoted-card" onclick="location.hash='#/token/${p.token_id}'">
        <div class="promoted-meta">
          <img class="promoted-logo" src="${escapeHtml(p.logo_url || '')}" alt="${escapeHtml(p.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
          <div>
            <div class="promoted-name">
              ${escapeHtml(p.name)} <span class="badge-promoted">PROMOTED</span>
            </div>
            <span style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">${escapeHtml(p.chain.replace('-ecosystem',''))}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="promoted-price">${fmtPrice(p.price)}</div>
          <div>${fmtChg(p.change_24h)}</div>
        </div>
      </div>
    `).join('');

    app.innerHTML = `
      <!-- PROMOTED TOKENS SECTION -->
      ${data.promoted && data.promoted.length > 0 ? `
        <section class="promoted-section">
          <h3 class="section-headline">🔥 Promoted Tokens</h3>
          <div class="promoted-grid">${promotedCards}</div>
        </section>
      ` : ''}

      <!-- TABS & CHAIN CONTROLS -->
      <div class="controls-bar">
        <div class="subtabs" id="homeTabs">
          <span class="subtab ${homeState.tab === 'trending' ? 'is-active' : ''}" data-tab="trending">🔥 Trending</span>
          <span class="subtab ${homeState.tab === 'top' ? 'is-active' : ''}" data-tab="top">🏆 Top Coins</span>
          <span class="subtab ${homeState.tab === 'new' ? 'is-active' : ''}" data-tab="new">🆕 New Coins</span>
          <span class="subtab ${homeState.tab === 'hot' ? 'is-active' : ''}" data-tab="hot">⚡ Hot Coins</span>
          <span class="subtab ${homeState.tab === 'gainers' ? 'is-active' : ''}" data-tab="gainers">📈 Top Gainers</span>
        </div>

        <div class="chains" id="homeChains">
          ${Object.keys(CHAINS).map(k => `
            <button class="chain-pill ${homeState.chain === k ? 'is-active' : ''}" data-chain="${k}">
              ${CHAINS[k].label}
            </button>
          `).join('')}
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
            <tr><td colspan="14" class="state-msg">Loading tokens…</td></tr>
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
              <svg class="source-logo-inline" viewBox="0 0 32 32" width="14" height="14" fill="none" style="vertical-align:-2px;margin:0 2px;"><circle cx="16" cy="16" r="16" fill="#3861FB"/><path d="M21.5 16C21.5 19 19 21.5 16 21.5C13 21.5 10.5 19 10.5 16C10.5 13 13 10.5 16 10.5C17.5 10.5 18.8 11.1 19.8 12.1L21.2 10.7C19.9 9.3 18 8.5 16 8.5C11.9 8.5 8.5 11.9 8.5 16C8.5 20.1 11.9 23.5 16 23.5C20.1 23.5 23.5 20.1 23.5 16H21.5Z" fill="#FFFFFF"/></svg> CoinMarketCap Pro,
              <svg class="source-logo-inline" viewBox="0 0 32 32" width="14" height="14" fill="none" style="vertical-align:-2px;margin:0 2px;"><circle cx="16" cy="16" r="16" fill="#8DC63F"/><path d="M16.5 8C12 8 9 11 9 15.5C9 18 10.2 20.3 12 21.5C11.6 22.4 11.3 23.5 11.5 24.5C11.7 25.1 12.3 25.5 13 25.2C13.9 24.7 14.7 24 15.4 23.1C15.8 23.2 16.1 23.2 16.5 23.2C21 23.2 25 19.7 25 15.5C25 11 21 8 16.5 8ZM13.5 14.2C12.6 14.2 11.9 13.5 11.9 12.6C11.9 11.7 12.6 11 13.5 11C14.4 11 15.1 11.7 15.1 12.6C15.1 13.5 14.4 14.2 13.5 14.2Z" fill="#1B222C"/><circle cx="13.5" cy="12.6" r="1" fill="#FFFFFF"/></svg> CoinGecko 
              &amp; <svg class="source-logo-inline" viewBox="0 0 32 32" width="14" height="14" fill="none" style="vertical-align:-2px;margin:0 2px;"><rect width="32" height="32" rx="16" fill="#131722"/><path d="M7 23.5L15 8.5L18.5 17L24.5 8.5" stroke="#00E5FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> DexScreener
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

    // Bind Home chains
    document.getElementById('homeChains').addEventListener('click', (e) => {
      const pill = e.target.closest('.chain-pill');
      if (!pill) return;
      homeState.chain = pill.dataset.chain;
      state.chain = pill.dataset.chain;
      document.querySelectorAll('#homeChains .chain-pill').forEach(el => el.classList.remove('is-active'));
      pill.classList.add('is-active');
      loadHomeTab(homeState.tab, 1, false);
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

    <div class="controls-bar">
      <div class="chains" id="topChains">
        ${Object.keys(CHAINS).map(k => `
          <button class="chain-pill ${state.chain === k ? 'is-active' : ''}" data-chain="${k}">
            ${CHAINS[k].label}
          </button>
        `).join('')}
      </div>
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

  document.getElementById('topChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    state.page = 1;
    renderTopCoins();
  });

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

    <div class="controls-bar">
      <div class="chains" id="newChains">
        ${Object.keys(CHAINS).map(k => `
          <button class="chain-pill ${state.chain === k ? 'is-active' : ''}" data-chain="${k}">
            ${CHAINS[k].label}
          </button>
        `).join('')}
      </div>
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

  document.getElementById('newChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    state.page = 1;
    renderNewCoins();
  });

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

    <div class="controls-bar">
      <div class="chains" id="hotChains">
        ${Object.keys(CHAINS).map(k => `
          <button class="chain-pill ${state.chain === k ? 'is-active' : ''}" data-chain="${k}">
            ${CHAINS[k].label}
          </button>
        `).join('')}
      </div>
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

  document.getElementById('hotChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    state.page = 1;
    renderHotCoins();
  });

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

    <div class="controls-bar">
      <div class="chains" id="gainersChains">
        ${Object.keys(CHAINS).map(k => `
          <button class="chain-pill ${state.chain === k ? 'is-active' : ''}" data-chain="${k}">
            ${CHAINS[k].label}
          </button>
        `).join('')}
      </div>
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

  document.getElementById('gainersChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    state.page = 1;
    renderGainers();
  });

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
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Promoted Tokens</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Active sponsored partner projects with active promotion records.</p>
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

    container.innerHTML = res.data.map(p => `
      <div class="promoted-card" onclick="location.hash='#/token/${p.token_id}'">
        <div class="promoted-meta">
          <img class="promoted-logo" src="${escapeHtml(p.logo_url || '')}" alt="${escapeHtml(p.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
          <div>
            <div class="promoted-name">
              ${escapeHtml(p.name)} <span class="badge-promoted">PROMOTED</span>
            </div>
            <span style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">${escapeHtml(p.chain.replace('-ecosystem',''))}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="promoted-price">${fmtPrice(p.price)}</div>
          <div>${fmtChg(p.change_24h)}</div>
        </div>
      </div>
    `).join('');

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
      const summaryIcon = isCritical ? '🚨' : isWarn ? '⚠️' : '🛡️';
      const summaryTitle = isCritical ? 'High / Critical Risk' : isWarn ? 'Medium Risk / Warning' : 'Safe / Low Risk';

      resultContainer.innerHTML = `
        <div class="risk-summary ${summaryClass}">
          <div>
            <div class="risk-badge-title">${summaryIcon} ${summaryTitle}</div>
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
      <div style="font-size:2rem;margin-bottom:0.5rem;">🚀</div>
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

        <button type="submit" class="submit-btn" id="submitBtn">Submit Token 🚀</button>
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
          <h2>🎉 Token Submitted Successfully</h2>
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
      btn.textContent = 'Submit Token 🚀';
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
    if (t.website_url) socials.push(`<a href="${escapeHtml(t.website_url)}" target="_blank" rel="noopener">🌐 Website</a>`);
    if (t.x_url) socials.push(`<a href="${escapeHtml(t.x_url)}" target="_blank" rel="noopener">𝕏 Twitter</a>`);
    if (t.telegram_url) socials.push(`<a href="${escapeHtml(t.telegram_url)}" target="_blank" rel="noopener">✈ Telegram</a>`);

    // Dynamic SEO
    document.title = `${t.name} ($${t.symbol}) Price, Market Cap & Data | Bulls Traking`;

    app.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <a href="#/" style="color:var(--text-faint);font-size:12.5px;">← Back to Toplist</a>
      </div>

      <div class="detail-head">
        <img src="${escapeHtml(t.logo_url || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png')}" alt="${escapeHtml(t.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
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
        <div class="stat-box"><div class="label">Hot Score</div><div class="value" style="color:var(--ember);">🔥 ${t.hot_score || 'N/A'}</div></div>
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
          <img src="${escapeHtml(t.logo_url || '')}" alt="${escapeHtml(t.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
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
  chain: 'all',
  page: 1,
  limit: 25
};

async function renderNewPairs() {
  document.title = 'New Pairs Radar | Bulls Traking';
  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">New Pairs Radar</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Real-time on-chain pair discovery, profiling telemetry, and newly minted pool tracking across leading DEXs.</p>
    </div>

    <!-- RADAR DISCLAIMER BANNER -->
    <div class="radar-disclaimer">
      <span class="icon">ℹ</span>
      <div>
        <b>Real-time discovery feed:</b> Sourced via DexScreener's public token profile stream across Solana, Ethereum, BNB Chain, and Base. Pairs are indexed upon profile submission. Trading newly created pairs carries extreme volatility and high capital risk. Always verify contract security before interacting.
      </div>
    </div>

    <!-- TABS & CHAIN CONTROLS -->
    <div class="controls-bar">
      <div class="subtabs" id="radarTabs">
        <span class="subtab ${newPairsState.tab === 'latest' ? 'is-active' : ''}" data-tab="latest">⚡ Latest (< 24h)</span>
        <span class="subtab ${newPairsState.tab === 'trending' ? 'is-active' : ''}" data-tab="trending">🔥 Trending Pools</span>
        <span class="subtab ${newPairsState.tab === 'matured' ? 'is-active' : ''}" data-tab="matured">🛡 Matured (> 7d)</span>
      </div>

      <div class="chains" id="radarChains">
        ${Object.keys(CHAINS).map(k => `
          <button class="chain-pill ${newPairsState.chain === k ? 'is-active' : ''}" data-chain="${k}">
            ${CHAINS[k].label}
          </button>
        `).join('')}
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

  document.getElementById('radarChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    newPairsState.chain = pill.dataset.chain;
    newPairsState.page = 1;
    renderNewPairs();
  });

  loadRadarPairs();
}

function renderRadarRows(pairs, startIdx = 0) {
  if (!pairs || pairs.length === 0) {
    return `<tr><td colspan="9" class="state-msg">No newly discovered pairs in this classification.</td></tr>`;
  }

  return pairs.map((p, idx) => {
    const chainLabel = (p.chain || '').replace('-ecosystem', '').toUpperCase();
    const age = fmtAge(p.pair_created_at);
    const txns = p.txn_count_24h != null && p.txn_count_24h > 0 ? Number(p.txn_count_24h).toLocaleString() : '—';
    const shortAddress = p.pair_address ? `${p.pair_address.slice(0, 4)}...${p.pair_address.slice(-4)}` : '';
    
    const dsChain = p.chain === 'solana-ecosystem' ? 'solana' : p.chain === 'binance-smart-chain' ? 'bsc' : p.chain === 'ethereum-ecosystem' ? 'ethereum' : 'base';
    const dsUrl = `https://dexscreener.com/${dsChain}/${p.pair_address}`;

    return `
      <tr>
        <td>${startIdx + idx + 1}</td>
        <td>
          <div class="token-cell">
            <img src="${escapeHtml(p.logo_url || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png')}" alt="${escapeHtml(p.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
            <div>
              <span class="token-name">${escapeHtml(p.name)}</span>
              <span class="token-sym">${escapeHtml(p.symbol)}</span>
              <div style="font-size:11px;color:var(--text-faint);margin-top:2px;">
                Pool: <code>${shortAddress}</code>
              </div>
            </div>
          </div>
        </td>
        <td class="cell-price"><b>${fmtPrice(p.price)}</b></td>
        <td>${fmtUsd(p.liquidity)}</td>
        <td>${fmtUsd(p.volume_24h)}</td>
        <td>${txns}</td>
        <td><span class="badge-age">${age}</span></td>
        <td><span class="badge-age" style="background:rgba(255,255,255,0.06);color:var(--text-faint);">${chainLabel}</span></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <a href="#/scan" onclick="sessionStorage.setItem('scan_address', '${escapeHtml(p.token_address)}'); sessionStorage.setItem('scan_chain', '${escapeHtml(p.chain)}');" class="btn-ghost" style="padding:2px 8px;font-size:11px;">Scan</a>
            <a href="${dsUrl}" target="_blank" rel="noopener" style="font-size:11px;color:var(--cyan);">Pool ↗</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadRadarPairs() {
  const tbody = document.getElementById('radarTableBody');
  const btnMore = document.getElementById('btnLoadMoreRadar');

  try {
    const res = await fetchApi(`/new-pairs?tab=${newPairsState.tab}&chain=${newPairsState.chain}&page=${newPairsState.page}&limit=${newPairsState.limit}`);
    const pairs = res.pairs || [];
    tbody.innerHTML = renderRadarRows(pairs, 0);

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
              tbody.insertAdjacentHTML('beforeend', renderRadarRows(nextPairs, startIdx));
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

/* ---------------- 3d. TELEGRAM SIGNALS VIEW (/signals) (Phase 3 Task 3) ---------------- */

let signalsState = {
  direction: 'all',
  page: 1,
  limit: 20
};

async function renderSignalsPage() {
  document.title = 'Telegram & Market Alpha Signals | Bulls Traking';
  app.innerHTML = `
    <div class="page-head">
      <h1 style="font-family:var(--display);margin:0 0 .4rem;font-size:1.75rem;">Telegram & Market Alpha Signals</h1>
      <p style="color:var(--text-muted);font-size:13px;margin:0 0 1.25rem;">Curated on-chain trade setups, breakout telemetry, and risk warnings aggregated from verified Telegram alpha channels.</p>
    </div>

    <!-- DIRECTION FILTER TABS -->
    <div class="controls-bar">
      <div class="subtabs" id="signalsTabs">
        <span class="subtab ${signalsState.direction === 'all' ? 'is-active' : ''}" data-dir="all">All Signals</span>
        <span class="subtab ${signalsState.direction === 'buy' ? 'is-active' : ''}" data-dir="buy">🟢 Buy / Long</span>
        <span class="subtab ${signalsState.direction === 'sell' ? 'is-active' : ''}" data-dir="sell">🔴 Sell / Take Profit</span>
        <span class="subtab ${signalsState.direction === 'watch' ? 'is-active' : ''}" data-dir="watch">🟡 Watchlist / Alert</span>
      </div>
    </div>

    <div id="signalsList"><div class="state-msg">Loading alpha signals…</div></div>
  `;

  document.getElementById('signalsTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.subtab');
    if (!tab) return;
    signalsState.direction = tab.dataset.dir;
    signalsState.page = 1;
    renderSignalsPage();
  });

  loadSignals();
}

async function loadSignals() {
  const container = document.getElementById('signalsList');
  try {
    const queryDir = signalsState.direction === 'all' ? '' : `&direction=${signalsState.direction}`;
    const res = await fetchApi(`/signals?page=${signalsState.page}&limit=${signalsState.limit}${queryDir}`);
    const signals = res.signals || [];

    if (signals.length === 0) {
      container.innerHTML = `<div class="state-msg">No active signals found in this category.</div>`;
      return;
    }

    const cards = signals.map(s => {
      const dirCls = s.direction === 'buy' ? 'buy' : s.direction === 'sell' ? 'sell' : 'watch';
      const dirIcon = s.direction === 'buy' ? '▲ BUY' : s.direction === 'sell' ? '▼ SELL' : '● WATCH';
      const timeAgo = fmtAge(s.posted_at);

      let tokenPill = '';
      if (s.token_symbol) {
        tokenPill = `
          <div class="signal-token-pill" onclick="location.hash='#/token/${s.token_id}'">
            <img src="${escapeHtml(s.token_logo_url || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png')}" alt="${escapeHtml(s.token_symbol)}">
            <span>$${escapeHtml(s.token_symbol)} (${fmtPrice(s.token_price)})</span>
          </div>
        `;
      }

      return `
        <div class="signal-card">
          <div>
            <div class="signal-header">
              <span class="signal-badge ${dirCls}">${dirIcon}</span>
              <span class="signal-source-badge">${escapeHtml((s.source || 'telegram').replace(/_/g, ' ').toUpperCase())}</span>
            </div>
            <h3 class="signal-title">${escapeHtml(s.title)}</h3>
            <div class="signal-body">${escapeHtml(s.message)}</div>
          </div>
          <div class="signal-footer">
            <div>${tokenPill || '<span style="color:var(--text-faint);">Market-wide Setup</span>'}</div>
            <span>${timeAgo}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="signals-grid">${cards}</div>`;
  } catch (err) {
    container.innerHTML = `<div class="state-msg">Failed to load signals: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- 10. LEGAL & INFO PAGES (Phase 3 Task 4) ---------------- */

const LEGAL_DISCLAIMER_NOTICE = `
  <div class="legal-disclaimer-box">
    ⚠️ <b>Legal Review Disclaimer:</b> This document is an initial operational placeholder provided for platform structure demonstration. Prior to production launch in regulated jurisdictions, this agreement must undergo formal review by qualified digital asset and securities legal counsel.
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
      <p>None of the content, price data, market rankings, security risk scores, or Telegram signals provided on Bulls Traking constitutes financial, legal, investment, or trading advice. All information is provided for general informational and educational purposes only.</p>

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
  } else if (path === '/signals') {
    renderSignalsPage();
  } else if (path === '/scan') {
    renderScanner();
  } else if (path === '/promoted') {
    renderPromotedPage();
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

