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
  tab: 'top',
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

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return '';
  } catch (e) {
    if (trimmed.startsWith('#/') || (trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('assets/')) {
      return trimmed;
    }
    return '';
  }
};

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

const formatChainLabel = (chain) => {
  if (!chain) return '';
  const c = String(chain).toLowerCase().trim();
  if (c === 'binance-smart-chain' || c === 'bsc') return 'BSC';
  if (c === 'ethereum' || c === 'ethereum-ecosystem' || c === 'eth') return 'ETH';
  if (c === 'solana' || c === 'solana-ecosystem' || c === 'sol') return 'SOL';
  if (c === 'base' || c === 'base-ecosystem') return 'BASE';
  if (c === 'bitcoin' || c === 'btc') return 'BTC';
  if (c === 'ripple' || c === 'xrp') return 'XRP';
  if (c === 'cardano' || c === 'ada') return 'ADA';
  if (c === 'dogecoin' || c === 'doge') return 'DOGE';
  if (c === 'avalanche' || c === 'avax') return 'AVAX';
  if (c === 'polkadot' || c === 'dot') return 'DOT';
  if (c === 'polygon' || c === 'polygon-ecosystem' || c === 'matic') return 'POL';
  if (c === 'sui') return 'SUI';
  if (c === 'near') return 'NEAR';
  if (c === 'tron' || c === 'trx') return 'TRX';
  if (c === 'litecoin' || c === 'ltc') return 'LTC';
  return c.replace('-ecosystem', '').toUpperCase();
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
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '#' || hash === '') {
    // Will be populated by renderHome without redundant network request
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

  const safeWeb = sanitizeUrl(t.website_url);
  if (safeWeb) {
    links.push(`
      <a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn web" title="Website" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </a>
    `);
  }

  const safeX = sanitizeUrl(t.x_url);
  if (safeX) {
    links.push(`
      <a href="${escapeHtml(safeX)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn x" title="X / Twitter" onclick="event.stopPropagation();">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
    `);
  }

  const safeTg = sanitizeUrl(t.telegram_url);
  if (safeTg) {
    links.push(`
      <a href="${escapeHtml(safeTg)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn tg" title="Telegram Community" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
      </a>
    `);
  }

  const safeReddit = sanitizeUrl(t.reddit_url);
  if (safeReddit) {
    links.push(`
      <a href="${escapeHtml(safeReddit)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn reddit" title="Reddit Community" onclick="event.stopPropagation();">
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

function renderMobileSocialLinks(t) {
  if (!t) return '';
  const links = [];

  const safeWeb = sanitizeUrl(t.website_url);
  if (safeWeb) {
    links.push(`
      <a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn web" title="Website" aria-label="Website" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </a>
    `);
  }

  const safeX = sanitizeUrl(t.x_url);
  if (safeX) {
    links.push(`
      <a href="${escapeHtml(safeX)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn x" title="X / Twitter" aria-label="X / Twitter" onclick="event.stopPropagation();">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
    `);
  }

  const safeTg = sanitizeUrl(t.telegram_url);
  if (safeTg) {
    links.push(`
      <a href="${escapeHtml(safeTg)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn tg" title="Telegram Community" aria-label="Telegram" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
      </a>
    `);
  }

  const safeReddit = sanitizeUrl(t.reddit_url);
  if (safeReddit) {
    links.push(`
      <a href="${escapeHtml(safeReddit)}" target="_blank" rel="noopener noreferrer sponsored" class="social-btn reddit" title="Reddit Community" aria-label="Reddit" onclick="event.stopPropagation();">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702zM9.25 12C8.56 12 8 12.56 8 13.25c0 .687.56 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
      </a>
    `);
  }

  if (links.length === 0) return '';
  return links.join('');
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
    const mobileSocials = renderMobileSocialLinks(t);

    return `
      <tr data-token-symbol="${escapeHtml(t.symbol)}" data-token-id="${t.id}" onclick="location.hash='#/token/${t.id}'">
        <td class="col-rank">${t.market_cap_rank || idx + 1}</td>
        <td class="col-token">
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
                <span class="chain-tag">${escapeHtml(formatChainLabel(t.chain))}</span>
                ${mobileSocials ? `<div class="social-links-mobile" onclick="event.stopPropagation();">${mobileSocials}</div>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="col-price cell-price"><b>${fmtPrice(t.price)}</b></td>
        <td class="col-1h">${fmtChg(t.change_1h)}</td>
        <td class="col-24h cell-change">${fmtChg(t.change_24h)}</td>
        <td class="col-7d">${fmtChg(t.change_7d)}</td>
        <td class="col-6h">${chg6h}</td>
        <td class="col-txn">${txnCount}</td>
        <td class="col-lp">${lpVal}</td>
        <td class="col-vol">${fmtUsd(t.volume_24h)}</td>
        <td class="col-mcap">${fmtUsd(t.market_cap)}</td>
        <td class="col-socials cell-socials" onclick="event.stopPropagation();">
          ${renderSocialLinks(t)}
        </td>
        <td class="col-spark">${spark}</td>
      </tr>
    `;
  }).join('');
}

/* ---------------- 1. HOME VIEW ---------------- */

function mergeLocalSubmissions(fetchedTokens) {
  try {
    const raw = localStorage.getItem('bt_submitted_tokens');
    if (!raw) return fetchedTokens || [];
    let local = JSON.parse(raw);
    if (!Array.isArray(local) || local.length === 0) return fetchedTokens || [];

    // Filter out mock test tokens so only authentic tokens like Kedolikswap remain
    local = local.filter(l => {
      const name = (l.name || '').toLowerCase();
      return !name.includes('cyber bull') && !name.includes('solana bull') && !name.includes('bnb gold') && !name.includes('production test');
    });
    try { localStorage.setItem('bt_submitted_tokens', JSON.stringify(local)); } catch (_) {}

    const existingIds = new Set((fetchedTokens || []).map(t => String(t.id)));
    const existingCas = new Set((fetchedTokens || []).map(t => (t.contract_address || '').toLowerCase()));

    const toPrepend = [];
    for (const l of local) {
      const ca = (l.contract_address || '').toLowerCase();
      if (!existingIds.has(String(l.id)) && (!ca || !existingCas.has(ca))) {
        toPrepend.push({
          ...l,
          is_submitted: 1,
          is_local_recent: true,
          age: l.age || 'Just now',
          sparkline: l.sparkline || [0.000095, 0.0001]
        });
      }
    }
    return [...toPrepend, ...(fetchedTokens || [])];
  } catch (e) {
    return fetchedTokens || [];
  }
}

let homeState = {
  tab: 'top',
  page: 1,
  limit: 20,
  chain: 'all',
  total: 0
};

function renderHomeSkeleton() {
  const rows = Array.from({ length: 12 }, (_, i) => `
    <tr>
      <td style="width:32px;"></td>
      <td style="color:var(--text-faint);font-weight:600;">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="skeleton-avatar"></div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <div class="skeleton-line" style="width:65px;height:12px;"></div>
            <div class="skeleton-line" style="width:35px;height:10px;"></div>
          </div>
        </div>
      </td>
      <td><div class="skeleton-line" style="width:70px;height:14px;"></div></td>
      <td class="col-1h"><div class="skeleton-line" style="width:42px;height:12px;"></div></td>
      <td><div class="skeleton-line" style="width:48px;height:12px;"></div></td>
      <td class="col-7d"><div class="skeleton-line" style="width:42px;height:12px;"></div></td>
      <td class="col-6h"><div class="skeleton-line" style="width:42px;height:12px;"></div></td>
      <td class="col-txn"><div class="skeleton-line" style="width:38px;height:12px;"></div></td>
      <td class="col-lp"><div class="skeleton-line" style="width:55px;height:12px;"></div></td>
      <td class="col-vol"><div class="skeleton-line" style="width:68px;height:12px;"></div></td>
      <td class="col-mcap"><div class="skeleton-line" style="width:80px;height:12px;"></div></td>
      <td class="col-socials"><div class="skeleton-line" style="width:40px;height:12px;"></div></td>
      <td class="col-spark"><div class="skeleton-line" style="width:90px;height:22px;"></div></td>
    </tr>
  `).join('');

  app.innerHTML = `
    <!-- HOMEPAGE BANNER STRIP SKELETON (TOP100TOKEN STYLE) -->
    <div class="banner-strip" id="homeBannerStrip" aria-label="Sponsored Banners">
      <a href="#/promote" class="banner-strip-item banner-strip-placeholder"><div class="banner-placeholder-text"><span class="banner-placeholder-title">Advertise in this spot</span><span class="banner-placeholder-sub">Book Slot #1 &bull; $149/7D &rarr;</span></div></a>
      <a href="#/promote" class="banner-strip-item banner-strip-placeholder"><div class="banner-placeholder-text"><span class="banner-placeholder-title">Advertise in this spot</span><span class="banner-placeholder-sub">Book Slot #2 &bull; $199/7D &rarr;</span></div></a>
      <a href="#/promote" class="banner-strip-item banner-strip-placeholder"><div class="banner-placeholder-text"><span class="banner-placeholder-title">Advertise in this spot</span><span class="banner-placeholder-sub">Book Slot #3 &bull; $149/7D &rarr;</span></div></a>
    </div>

    <div class="controls-bar">
      <div class="subtabs" id="homeTabs">
        <span class="subtab is-active" data-tab="top">Top Coins</span>
        <span class="subtab" data-tab="new">New Coins</span>
        <span class="subtab" data-tab="gainers">Top Gainers</span>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">#</th>
            <th class="col-token">Token</th>
            <th class="col-price">Price</th>
            <th class="col-1h">1h</th>
            <th class="col-24h">24h</th>
            <th class="col-7d">7d</th>
            <th class="col-6h">6h</th>
            <th class="col-txn">TXN</th>
            <th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th>
            <th class="col-mcap">Market Cap</th>
            <th class="col-socials">Socials</th>
            <th class="col-spark">Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="homeTableBody">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------------- Banner Ads helpers & Site-Wide Placement System ---------------- */

const pageViewImpressionSet = new Set();
let lastTrackedPageHash = null;

function checkPageImpression(bannerId) {
  const currentHash = window.location.hash || '#/';
  if (currentHash !== lastTrackedPageHash) {
    pageViewImpressionSet.clear();
    lastTrackedPageHash = currentHash;
  }
  if (!bannerId) return false;
  if (pageViewImpressionSet.has(bannerId)) return false;
  pageViewImpressionSet.add(bannerId);
  return true;
}

function trackBannerImpressionOnce(bannerId) {
  if (!bannerId || !checkPageImpression(bannerId)) return;
  fetchApi('/promotion/banners/' + bannerId + '/impression', { method: 'POST' }).catch(() => {
    fetchApi('/banners/impression/' + bannerId, { method: 'POST' }).catch(() => {});
  });
}

function handleBannerClick(event, bannerId) {
  if (!bannerId) return;
  fetchApi('/promotion/banners/' + bannerId + '/click', { method: 'POST' }).catch(() => {
    fetchApi('/banners/click/' + bannerId, { method: 'POST' }).catch(() => {});
  });
}
window.handleBannerClick = handleBannerClick;

function trackBannerClick(bannerId) {
  handleBannerClick(null, bannerId);
}

function getBannerSlotHtml(banner, slotNum, isMobileActive = false) {
  const bannerImg = banner?.banner_url || banner?.banner_image;
  const hasBanner = banner && bannerImg && !banner.is_placeholder;
  const defaultPrice = slotNum === 2 ? '$199/7D' : '$149/7D';
  const mobileClass = isMobileActive ? ' is-mobile-active' : '';

  if (hasBanner) {
    const rawTarget = banner.target_url || '#/promote';
    const targetUrl = sanitizeUrl(rawTarget) || '#/promote';
    const title = banner.title || 'Sponsored Partner';
    const clickAttr = banner.id ? `onclick="handleBannerClick(event, ${banner.id})"` : '';
    return `
      <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer sponsored" class="banner-strip-item banner-strip-link${mobileClass}" data-banner-id="${banner.id || ''}" ${clickAttr} title="${escapeHtml(title)}">
        <img src="${escapeHtml(bannerImg)}" alt="${escapeHtml(title)}" class="banner-strip-img" onerror="this.onerror=null; this.parentElement.className='banner-strip-item banner-strip-placeholder${mobileClass}'; this.parentElement.removeAttribute('target'); this.parentElement.href='#/promote?type=banner&slot=${slotNum}'; this.parentElement.innerHTML='<div class=\\'banner-placeholder-text\\'><span class=\\'banner-placeholder-title\\'>Advertise in this spot</span><span class=\\'banner-placeholder-sub\\'>Book Slot #${slotNum} &bull; ${defaultPrice} &rarr;</span></div>';" />
      </a>
    `;
  }

  return `
    <a href="#/promote?type=banner&slot=${slotNum}" class="banner-strip-item banner-strip-placeholder${mobileClass}" title="Advertise in this spot">
      <div class="banner-placeholder-text">
        <span class="banner-placeholder-title">Advertise in this spot</span>
        <span class="banner-placeholder-sub">Book Slot #${slotNum} &bull; ${defaultPrice} &rarr;</span>
      </div>
    </a>
  `;
}

/**
 * Site-wide banner placement renderer
 * Centralized, deduplicated impression tracking per page view, excluded from legal & admin views.
 */
async function renderSiteWideBanner(containerId, placementType = 'top_leaderboard') {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const currentHash = (window.location.hash || '').toLowerCase();
  // Exclude from admin, legal, privacy, terms, disclaimer, cookie, about views
  if (
    currentHash.includes('/admin') ||
    currentHash.includes('/terms') ||
    currentHash.includes('/privacy') ||
    currentHash.includes('/disclaimer') ||
    currentHash.includes('/cookies') ||
    currentHash.includes('/about')
  ) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetchApi('/promotion/banners/active');
    const activeData = res?.data || res || {};

    if (placementType === 'top_leaderboard') {
      const rot = activeData.rotation || {};
      const activeSlotIndex = typeof rot.activeSlotIndex === 'number' && rot.activeSlotIndex >= 0 ? rot.activeSlotIndex : 0;

      const slots = [
        { slotNum: 1, banner: activeData.top_banner_1 || (activeData.top_banners && activeData.top_banners[0]) || activeData.top_banner },
        { slotNum: 2, banner: activeData.top_banner_2 || (activeData.top_banners && activeData.top_banners[1]) || activeData.homepage_banner },
        { slotNum: 3, banner: activeData.top_banner_3 || (activeData.top_banners && activeData.top_banners[2]) || activeData.presale_banner }
      ];

      // Track impressions: On mobile viewport, track ONLY the active mobile banner
      // On desktop, track visible banners
      const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 767;
      if (isMobileViewport) {
        const activeMobileBanner = activeData.mobile || slots[activeSlotIndex]?.banner;
        if (activeMobileBanner?.id && !activeMobileBanner.is_placeholder) {
          trackBannerImpressionOnce(activeMobileBanner.id);
        }
      } else {
        slots.forEach(({ banner }) => {
          if (banner?.id && !banner.is_placeholder) {
            trackBannerImpressionOnce(banner.id);
          }
        });
      }

      container.innerHTML = `
        <div class="banner-strip banner-trio-grid" aria-label="Sponsored Banners">
          ${slots.map(({ slotNum, banner }, idx) => getBannerSlotHtml(banner, slotNum, idx === activeSlotIndex)).join('')}
        </div>
      `;
      container.style.display = 'block';
      return;
    }

    let bannerObj = null;
    if (placementType === 'homepage_in_feed') {
      bannerObj = activeData.in_feed_banner || activeData.homepage_banner;
    } else if (placementType === 'radar' || placementType === 'new_pairs') {
      bannerObj = activeData.radar_banner || activeData.top_banner_1;
    } else if (placementType === 'presale') {
      bannerObj = activeData.presale_banner || activeData.top_banner_2;
    } else if (placementType === 'token_detail' || placementType === 'signals') {
      bannerObj = activeData.top_banner_3 || activeData.top_banner;
    } else {
      bannerObj = activeData[placementType] || null;
    }

    if (bannerObj && !bannerObj.is_placeholder && bannerObj.id) {
      trackBannerImpressionOnce(bannerObj.id);
      container.innerHTML = renderBannerAd(bannerObj, placementType);
      container.style.display = 'block';
    } else {
      container.innerHTML = '';
      container.style.display = 'none';
    }
  } catch (err) {
    console.warn('[SiteWideBanner] Failed to load banner for ' + placementType, err.message);
    container.innerHTML = '';
    container.style.display = 'none';
  }
}
window.renderSiteWideBanner = renderSiteWideBanner;

async function renderBannerStrip() {
  await renderSiteWideBanner('homeBannerStrip', 'top_leaderboard');
}
window.renderBannerStrip = renderBannerStrip;
window.renderBannerStrip = renderBannerStrip;

async function renderSpotlightBanner() {
  const container = document.getElementById('homeSpotlightWrapper');
  if (!container) return;
  try {
    const res = await fetchApi('/promotion/spotlight/active');
    const spotlight = res?.data || null;
    if (spotlight && !spotlight.is_placeholder && spotlight.id) {
      container.innerHTML = renderBannerAd(spotlight, 'homepage_banner');
      container.style.display = 'block';
    } else {
      container.innerHTML = '';
      container.style.display = 'none';
    }
  } catch (err) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}
window.renderSpotlightBanner = renderSpotlightBanner;

function renderBannerAd(banner, slotPlacement = 'homepage_banner') {
  if (!banner || banner.is_placeholder || !banner.id || !banner.title) {
    return '';
  }

  const rawTarget = banner.target_url || '#/promote';
  const targetUrl = sanitizeUrl(rawTarget) || '#/promote';
  const ctaText = banner.cta_text || 'Learn More →';
  const title = banner.title;
  const desc = banner.description || '';
  const bannerImg = banner.banner_image || banner.image_url || banner.logo_url;
  const clickHandler = banner.id ? `onclick="trackBannerClick(${banner.id})"` : '';
  const isExternal = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
  const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer sponsored"' : '';

  // If full banner graphic without text is uploaded
  if (bannerImg && !banner.title && !banner.description) {
    return `
      <div class="banner-ad-wrapper ${slotPlacement}">
        <a href="${escapeHtml(targetUrl)}" ${targetAttr} class="banner-ad-image-mode" ${clickHandler}>
          <div class="banner-ad-badge">SPONSORED</div>
          <img src="${escapeHtml(bannerImg)}" alt="${escapeHtml(title)}" class="banner-img" />
        </a>
      </div>
    `;
  }

  return `
    <div class="banner-ad-wrapper ${slotPlacement}">
      <div class="banner-ad-card">
        <div class="banner-ad-badge">SPONSORED</div>
        <div class="banner-ad-left">
          ${bannerImg ? `<img src="${escapeHtml(bannerImg)}" alt="${escapeHtml(title)}" class="banner-ad-icon-img" onerror="this.style.display='none'" />` : `<div class="banner-ad-icon">⚡</div>`}
          <div class="banner-ad-info">
            <div class="banner-ad-title">${escapeHtml(title)}</div>
            ${desc ? `<div class="banner-ad-desc">${escapeHtml(desc)}</div>` : ''}
          </div>
        </div>
        <a href="${escapeHtml(targetUrl)}" ${targetAttr} class="banner-ad-cta" ${clickHandler}>
          ${escapeHtml(ctaText)}
        </a>
      </div>
    </div>
  `;
}

function renderBannerTrioGrid(topBanners) {
  const slots = Array.isArray(topBanners) && topBanners.length >= 3
    ? topBanners.slice(0, 3)
    : [null, null, null];

  return `
    <div class="banner-strip banner-trio-grid" id="bannerTrioGrid" aria-label="Sponsored Banners (Trio Leaderboard)">
      ${slots.map((b, idx) => getBannerSlotHtml(b, idx + 1)).join('')}
    </div>
  `;
}

function buildHomeUI(data) {
  if (!data || typeof data !== 'object') return;
  if (data.marketStats) {
    updateMarketStatus(data.marketStats);
  }
  if (data.trending && data.trending.length > 0) {
    populateTape(data.trending.slice(0, 12));
  }

  const initialKey = homeState.tab === 'top' ? 'topCoins' : homeState.tab;
  const initialTokens = initialKey === 'new' ? mergeLocalSubmissions(data[initialKey] || []) : (data[initialKey] || []);

  function renderPromotedCard(p, idx = 0) {
    const chainName = formatChainLabel(p.chain);
    const rawTrade = p.auto_trading_url || (p.contract_address ? `https://dexscreener.com/search?q=${encodeURIComponent(p.contract_address)}` : null);
    const tradeUrl = rawTrade ? sanitizeUrl(rawTrade) : null;
    const isMobileActive = idx === (data.promotedRotation?.activeSlotIndex || data.rotation?.activeSlotIndex || 0);

    return `
      <article class="promoted-card ${isMobileActive ? 'is-mobile-active' : ''}" onclick="location.hash='#/token/${p.token_id}'">
        <div class="promoted-card-main">
          <img class="promoted-logo" src="${escapeHtml(normalizeTokenLogo(p.logo_url, p.symbol, p.name))}" alt="${escapeHtml(p.symbol)}" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(p.symbol)}', '${escapeHtml(p.name)}');">
          <div class="promoted-card-identity">
            <div class="promoted-name-row">
              <span class="promoted-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
              <span class="badge-promoted">PROMOTED</span>
            </div>
            <div class="promoted-card-actions">
              <span class="chain-tag" style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">${escapeHtml(chainName)}</span>
              ${tradeUrl ? `<a href="${escapeHtml(tradeUrl)}" target="_blank" rel="noopener noreferrer sponsored" class="btn-promoted-trade" onclick="event.stopPropagation();" title="Trade on DEX">Trade ↗</a>` : ''}
            </div>
            <div class="promoted-socials-mobile">
              ${renderSocialLinks(p)}
            </div>
          </div>
        </div>
        <div class="promoted-card-metrics">
          <div class="promoted-price">${fmtPrice(p.price)}</div>
          <div class="promoted-change">${fmtChg(p.change_24h)}</div>
          <div class="promoted-socials">
            ${renderSocialLinks(p)}
          </div>
        </div>
      </article>
    `;
  }

  const promotedCards = (data.promoted || []).map((p, idx) => renderPromotedCard(p, idx)).join('');
  const spotlightOrder = data.spotlight || null;
  const homeBannerHtml = spotlightOrder ? renderBannerAd(spotlightOrder, 'homepage_banner') : '';

  if (spotlightOrder?.id && !spotlightOrder.is_placeholder) {
    fetchApi('/promotion/banners/' + spotlightOrder.id + '/impression', { method: 'POST' }).catch(() => {
      fetchApi('/banners/impression/' + spotlightOrder.id, { method: 'POST' }).catch(() => {});
    });
  }

  const initialBanners = data.banners || {};
  const initialActiveIndex = initialBanners.rotation?.activeSlotIndex || 0;
  const initialSlots = [
    getBannerSlotHtml(initialBanners.top_banner || (initialBanners.top_banners && initialBanners.top_banners[0]), 1, initialActiveIndex === 0),
    getBannerSlotHtml(initialBanners.homepage_banner || (initialBanners.top_banners && initialBanners.top_banners[1]), 2, initialActiveIndex === 1),
    getBannerSlotHtml(initialBanners.presale_banner || (initialBanners.top_banners && initialBanners.top_banners[2]), 3, initialActiveIndex === 2)
  ].join('');

  const trioGridHtml = `
    <!-- 3-SLOT TOP BANNER STRIP (TOP100TOKEN STYLE) -->
    <div class="banner-strip" id="homeBannerStrip" aria-label="Sponsored Banners">
      ${initialSlots}
    </div>
  `;

  app.innerHTML = `
    ${trioGridHtml}

    <!-- PROMOTED TOKENS SECTION -->
    ${data.promoted && data.promoted.length > 0 ? `
      <section class="promoted-section">
        <h3 class="section-headline">Promoted Tokens</h3>
        <div class="promoted-grid">${promotedCards}</div>
      </section>
    ` : ''}

    <!-- HOMEPAGE IN-FEED TOKEN SPOTLIGHT -->
    ${homeBannerHtml ? `<div id="homeSpotlightWrapper">${homeBannerHtml}</div>` : `<div id="homeSpotlightWrapper" style="display:none;"></div>`}

    <!-- TABS & CHAIN CONTROLS -->
    <div class="controls-bar">
      <div class="subtabs" id="homeTabs">
        <span class="subtab ${homeState.tab === 'top' ? 'is-active' : ''}" data-tab="top">Top Coins</span>
        <span class="subtab ${homeState.tab === 'new' ? 'is-active' : ''}" data-tab="new">New Coins</span>
        <span class="subtab ${homeState.tab === 'gainers' ? 'is-active' : ''}" data-tab="gainers">Top Gainers</span>
      </div>
    </div>

    <!-- TOKEN TABLE -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">#</th>
            <th class="col-token">Token</th>
            <th class="col-price">Price</th>
            <th class="col-1h">1h</th>
            <th class="col-24h">24h</th>
            <th class="col-7d">7d</th>
            <th class="col-6h">6h</th>
            <th class="col-txn">TXN</th>
            <th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th>
            <th class="col-mcap">Market Cap</th>
            <th class="col-socials">Socials</th>
            <th class="col-spark">Last 7 Days</th>
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
      const tokens = tabName === 'new' ? mergeLocalSubmissions(data[tabKey]) : data[tabKey];
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
      const tokens = tabName === 'new' ? mergeLocalSubmissions(res.tokens || []) : (res.tokens || []);
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
        loadedCount: (page - 1) * homeState.limit + tokens.length
      });
    } catch (err) {
      if (!append) {
        tbody.innerHTML = `<tr><td colspan="14" class="state-msg">Error loading ${tabName} tokens: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  // Pagination bar builder
  function renderHomePagination(container, { tabName, page, limit, total, totalPages, loadedCount }) {
    if (!container) return;
    const start = 1;
    const end = Math.min(total, loadedCount || (page * limit));

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
          ${loadedCount < total ? `<button class="btn btn-secondary btn-load-more">Load More (+${Math.min(limit, total - loadedCount)})</button>` : ''}
        </div>
      </div>
    `;

    container.querySelector('.btn-load-more')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Loading…';
      loadHomeTab(homeState.tab, page + 1, true);
    });
  }

  // Bind Home tabs
  document.getElementById('homeTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.subtab');
    if (!tab) return;
    const targetTab = tab.dataset.tab;
    document.querySelectorAll('#homeTabs .subtab').forEach(el => el.classList.remove('is-active'));
    tab.classList.add('is-active');
    loadHomeTab(targetTab, 1, false);
  });

  // Load live banner strip & record impressions
  renderBannerStrip();

  // Initial load of active tab
  loadHomeTab(homeState.tab, 1, false);
}

async function renderHome() {
  homeState.page = 1;
  homeState.chain = state.chain || 'all';

  let cached = state.homeData;
  if (!cached) {
    try {
      const raw = sessionStorage.getItem('bulls_home_cache');
      if (raw) cached = JSON.parse(raw);
    } catch (_) {}
  }

  if (cached && cached.topCoins && cached.topCoins.length > 0) {
    buildHomeUI(cached);
  } else {
    renderHomeSkeleton();
  }

  try {
    const res = await fetchApi(`/home?chain=${homeState.chain}&limit=20&page=1`);
    const data = res?.data || res;
    if (data && (data.topCoins || data.trending)) {
      state.homeData = data;
      try {
        sessionStorage.setItem('bulls_home_cache', JSON.stringify(data));
      } catch (_) {}
      buildHomeUI(data);
    }
  } catch (err) {
    if (!cached) {
      app.innerHTML = `<div class="state-msg">Unable to load market data: ${escapeHtml(err.message)}</div>`;
    }
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
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">Rank</th><th class="col-token">Token</th><th class="col-price">Price</th><th class="col-1h">1h</th><th class="col-24h">24h</th><th class="col-7d">7d</th>
            <th class="col-6h">6h</th><th class="col-txn">TXN</th><th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th><th class="col-mcap">Market Cap</th><th class="col-socials">Socials</th><th class="col-spark">Last 7 Days</th>
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
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">#</th><th class="col-token">Token</th><th class="col-price">Price</th><th class="col-1h">1h</th><th class="col-24h">24h</th><th class="col-7d">7d</th>
            <th class="col-6h">6h</th><th class="col-txn">TXN</th><th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th><th class="col-mcap">Market Cap</th><th class="col-socials">Socials</th><th class="col-spark">Last 7 Days</th>
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
    document.getElementById('newTableBody').innerHTML = renderTokenRows(mergeLocalSubmissions(res.tokens || []), { showAge: true });

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
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">#</th><th class="col-token">Token</th><th class="col-price">Price</th><th class="col-1h">1h</th><th class="col-24h">24h</th><th class="col-7d">7d</th>
            <th class="col-6h">6h</th><th class="col-txn">TXN</th><th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th><th class="col-mcap">Market Cap</th><th class="col-socials">Socials</th><th class="col-spark">Last 7 Days</th>
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
          <span>Promote Your Coin</span>
        </a>
      </div>
    </div>
    <div id="promotedBannerWrap" style="margin-bottom:1.5rem;"></div>
    <div id="promotedGrid" class="promoted-grid">
      <div class="state-msg">Loading promoted tokens…</div>
    </div>
  `;

  renderSiteWideBanner('promotedBannerWrap', 'top_leaderboard');

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
            <th class="col-star" style="width:32px;"></th>
            <th class="col-rank">#</th><th class="col-token">Token</th><th class="col-price">Price</th><th class="col-1h">1h</th><th class="col-24h">24h</th><th class="col-7d">7d</th>
            <th class="col-6h">6h</th><th class="col-txn">TXN</th><th class="col-lp">LP</th>
            <th class="col-vol">24h Volume</th><th class="col-mcap">Market Cap</th><th class="col-socials">Socials</th><th class="col-spark">Last 7 Days</th>
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
  price: 149,
  days: 7,
  activeOrder: null
};

let bannerOrderState = {
  selectedPkg: 'banner_top_7d',
  price: 199,
  days: 7,
  placement: 'top_banner',
  activeOrder: null
};

function switchPromoteMode(mode) {
  const tokenSec = document.getElementById('promoteTokenSection');
  const bannerSec = document.getElementById('promoteBannerSection');
  const tabSpot = document.getElementById('tabSpotlightBtn');
  const tabBan = document.getElementById('tabBannerBtn');

  if (mode === 'banner') {
    if (tokenSec) tokenSec.style.display = 'none';
    if (bannerSec) bannerSec.style.display = 'block';
    if (tabSpot) {
      tabSpot.classList.remove('is-active');
      tabSpot.style.background = 'var(--bg-panel)';
      tabSpot.style.color = 'var(--ink)';
      tabSpot.style.borderColor = 'var(--line)';
    }
    if (tabBan) {
      tabBan.classList.add('is-active');
      tabBan.style.background = 'var(--gold)';
      tabBan.style.color = '#15130E';
      tabBan.style.borderColor = 'var(--gold)';
    }
  } else {
    if (tokenSec) tokenSec.style.display = 'block';
    if (bannerSec) bannerSec.style.display = 'none';
    if (tabSpot) {
      tabSpot.classList.add('is-active');
      tabSpot.style.background = 'var(--gold)';
      tabSpot.style.color = '#15130E';
      tabSpot.style.borderColor = 'var(--gold)';
    }
    if (tabBan) {
      tabBan.classList.remove('is-active');
      tabBan.style.background = 'var(--bg-panel)';
      tabBan.style.color = 'var(--ink)';
      tabBan.style.borderColor = 'var(--line)';
    }
  }
}
window.switchPromoteMode = switchPromoteMode;

async function renderPromotePage(initialType = 'token', initialSlot = null) {
  document.title = 'Promote & Advertise | Bulls Traking';
  promoteOrderState.selectedPkg = '7D';
  promoteOrderState.price = 149;
  promoteOrderState.days = 7;
  promoteOrderState.activeOrder = null;

  // Initialize selected banner slot
  if (initialSlot === '1') {
    bannerOrderState.selectedPkg = 'banner_slot_1';
    bannerOrderState.price = 149;
    bannerOrderState.days = 7;
    bannerOrderState.placement = 'top_banner_1';
  } else if (initialSlot === '3') {
    bannerOrderState.selectedPkg = 'banner_slot_3';
    bannerOrderState.price = 149;
    bannerOrderState.days = 7;
    bannerOrderState.placement = 'top_banner_3';
  } else {
    bannerOrderState.selectedPkg = 'banner_slot_2';
    bannerOrderState.price = 199;
    bannerOrderState.days = 7;
    bannerOrderState.placement = 'top_banner_2';
  }
  bannerOrderState.activeOrder = null;

  const isBannerMode = initialType === 'banner';

  app.innerHTML = `
    <div class="promote-container">
      <div class="page-head" style="text-align:center;margin-bottom:1.5rem;">
        <span style="display:inline-block;background:rgba(242,169,59,0.12);color:var(--gold);border:1px solid rgba(242,169,59,0.3);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-bottom:8px;">OFFICIAL ADVERTISING SUITE</span>
        <h1 style="font-family:var(--font-display);margin:0 0 .5rem;font-size:2rem;color:var(--ink);">Promote & Advertise on Bulls Traking</h1>
        <p style="color:var(--ink-dim);font-size:14px;max-width:640px;margin:0 auto;">
          Drive instant verified trading volume, reach 100K+ multi-chain crypto traders across Solana, BSC, Base & Ethereum with guaranteed placement.
        </p>
      </div>

      <!-- TYPE SWITCHER TABS -->
      <div class="promote-type-tabs">
        <button type="button" id="tabSpotlightBtn" class="promote-type-btn ${!isBannerMode ? 'is-active' : ''}" onclick="switchPromoteMode('token')" style="${!isBannerMode ? 'background:var(--gold);color:#15130E;border-color:var(--gold);' : 'background:var(--bg-panel);border:1px solid var(--line);color:var(--ink);'}">
          🪙 Token Spotlight ($39 - $399)
        </button>
        <button type="button" id="tabBannerBtn" class="promote-type-btn ${isBannerMode ? 'is-active' : ''}" onclick="switchPromoteMode('banner')" style="${isBannerMode ? 'background:var(--gold);color:#15130E;border-color:var(--gold);' : 'background:var(--bg-panel);border:1px solid var(--line);color:var(--ink);'}">
          📢 Banner Ads Placement ($149 - $499)
        </button>
      </div>

      <!-- SECTION 1: TOKEN SPOTLIGHT -->
      <div id="promoteTokenSection" style="display:${isBannerMode ? 'none' : 'block'};">
        <div class="promote-grid-layout">
          <!-- FORM COLUMN -->
          <div class="promote-col-form">
            <form id="promoteForm" class="promote-form" onsubmit="event.preventDefault(); submitPromotionOrder();">
              
              <h3 style="margin:0 0 1rem;font-size:1.1rem;color:var(--ink);">1. Token Information</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label for="pName">Token Name *</label>
                  <input type="text" id="pName" placeholder="e.g. Bulls Protocol" required>
                </div>
                <div class="form-group">
                  <label for="pSymbol">Token Symbol *</label>
                  <input type="text" id="pSymbol" placeholder="e.g. BULL" required>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label for="pChain">Network Chain *</label>
                  <select id="pChain" required>
                    <option value="bsc" selected>BNB Chain (BSC)</option>
                    <option value="solana">Solana</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="base">Base</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="pContract">Contract Address (CA) *</label>
                  <input type="text" id="pContract" placeholder="Token mint or contract address" required>
                </div>
              </div>

              <div class="form-group">
                <label>Token Logo * <span style="font-size:11px;color:var(--text-faint);">(PNG, JPG, WebP, SVG)</span></label>
                
                <!-- Direct File Upload Dropzone -->
                <div id="logoUploadDropzone" style="border:2px dashed var(--border);border-radius:10px;padding:1.25rem;text-align:center;background:rgba(255,255,255,0.02);cursor:pointer;transition:all 0.2s ease;" onclick="document.getElementById('pLogoFileInput').click()">
                  <input type="file" id="pLogoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;" onchange="handleLogoFileUpload(event)">
                  
                  <div id="logoUploadPlaceholder">
                    <div style="margin-bottom:6px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                    <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:2px;">
                      Click to Upload Token Logo File <span style="color:var(--gold);">or Drag & Drop</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">
                      Supports PNG, JPG, WebP, SVG up to 5MB
                    </div>
                  </div>

                  <!-- Active Uploaded Thumbnail & Info (Hidden Initially) -->
                  <div id="logoUploadPreviewWrap" style="display:none;align-items:center;justify-content:center;gap:12px;">
                    <img id="logoUploadThumb" src="" alt="Logo preview" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);box-shadow:0 0 10px rgba(245,166,35,0.3);">
                    <div style="text-align:left;">
                      <div id="logoUploadFileName" style="font-size:13px;font-weight:700;color:var(--ink);">logo.png</div>
                      <div style="font-size:11px;color:var(--up);font-weight:600;">✓ Logo Selected & Ready <span style="color:var(--text-muted);font-weight:normal;margin-left:6px;text-decoration:underline;cursor:pointer;">(Change file)</span></div>
                    </div>
                  </div>
                </div>

                <!-- Or enter URL toggle -->
                <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                  <button type="button" class="btn-ghost" onclick="toggleLogoUrlField()" style="font-size:11px;padding:2px 6px;text-decoration:underline;cursor:pointer;border:none;background:none;color:var(--text-muted);">
                    Or enter Image URL manually
                  </button>
                  <span id="logoUploadStatus" style="font-size:11px;color:var(--text-muted);"></span>
                </div>

                <div id="logoUrlFieldWrap" style="display:none;margin-top:8px;">
                  <input type="text" id="pLogo" placeholder="https://yourdomain.com/logo.png or uploaded image URL" style="font-size:12px;width:100%;box-sizing:border-box;">
                </div>
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">2. Social Links <span style="font-size:11px;color:var(--text-faint);font-weight:normal;">(Optional — only provided links will display icons)</span></h3>
              <div class="form-grid">
                <div class="form-group">
                  <label for="pWeb">Official Website</label>
                  <input type="text" id="pWeb" placeholder="https://yourproject.com">
                </div>
                <div class="form-group">
                  <label for="pX">X (Twitter) URL</label>
                  <input type="text" id="pX" placeholder="https://x.com/yourproject">
                </div>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label for="pTg">Telegram Community</label>
                  <input type="text" id="pTg" placeholder="https://t.me/yourcommunity">
                </div>
                <div class="form-group">
                  <label for="pReddit">Reddit Community</label>
                  <input type="text" id="pReddit" placeholder="https://reddit.com/r/yourproject">
                </div>
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">3. Select Promotion Package</h3>
              <div class="package-selector" id="pkgSelector">
                <div class="package-card" data-key="12H" data-price="39" data-days="0.5">
                  <div style="font-weight:700;font-size:14px;color:var(--ink);">12 Hours</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$39</div>
                  <div style="font-size:11px;color:var(--text-muted);">Quick Boost</div>
                </div>
                <div class="package-card" data-key="1D" data-price="59" data-days="1">
                  <div style="font-weight:700;font-size:14px;color:var(--ink);">1 Day</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$59</div>
                  <div style="font-size:11px;color:var(--text-muted);">24h Spotlight</div>
                </div>
                <div class="package-card is-selected" data-key="7D" data-price="149" data-days="7">
                  <span class="pkg-badge">POPULAR</span>
                  <div style="font-weight:700;font-size:14px;color:var(--ink);">7 Days</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$149</div>
                  <div style="font-size:11px;color:var(--text-muted);">Full Week Momentum</div>
                </div>
                <div class="package-card" data-key="30D" data-price="399" data-days="30">
                  <span class="pkg-badge" style="background:#00E5FF;">VIP</span>
                  <div style="font-weight:700;font-size:14px;color:var(--ink);">30 Days</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$399</div>
                  <div style="font-size:11px;color:var(--text-muted);">Maximum Dominance</div>
                </div>
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">4. Payment & Activation</h3>
              <div style="background:rgba(0,136,204,0.08);border:1px solid rgba(0,136,204,0.25);border-radius:10px;padding:1rem;margin-bottom:1.25rem;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#0088cc" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  <div>
                    <div style="color:var(--ink);font-size:13px;font-weight:700;">Official Telegram Ad Desk: <a href="https://t.me/bullclub_ads" target="_blank" style="color:#0088cc;text-decoration:underline;">@bullclub_ads</a></div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                      Fast direct clearance via official Telegram desk. Accepted: USDT (BEP20 / TRC20 / ERC20), SOL, BNB or On-Chain.
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" id="btnCreateOrder" class="btn-solid" style="width:100%;padding:13px 12px;font-size:14px;cursor:pointer;background:#0088cc;border-color:#0088cc;display:flex;align-items:center;justify-content:center;gap:8px;white-space:normal;text-align:center;box-sizing:border-box;">
                <span style="white-space:normal;word-break:break-word;">Book via Telegram @bullclub_ads ($149 USDT) →</span>
              </button>
            </form>

            <!-- ORDER PAYMENT / TELEGRAM CLEARANCE MODAL -->
            <div id="paymentArea" style="display:none;margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1.5rem;">
              <div style="background:rgba(0,136,204,0.06);border:1px solid rgba(0,136,204,0.3);border-radius:10px;padding:1.4rem;margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
                  <span style="font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;">PROMOTION ORDER <span id="dispOrderId" style="color:#0088cc;">#BT-1000</span></span>
                  <span style="background:rgba(245,166,35,0.15);color:var(--gold);border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;" id="dispOrderStatus">Awaiting Payment Clearance</span>
                </div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--ink);margin-bottom:6px;">
                  Amount: <span style="color:var(--up);" id="dispAmount">$149 USDT</span>
                </div>
                <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;line-height:1.5;">
                  Your order is reserved in our system! Contact our official Telegram desk <b>@bullclub_ads</b> with your order details for instant clearance and launch.
                </p>

                <!-- Telegram Primary Card -->
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.15rem;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;">Official Telegram Desk</span>
                    <span style="font-size:12px;color:#0088cc;font-weight:600;">@bullclub_ads</span>
                  </div>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                    <a id="btnOpenTgChat" href="https://t.me/bullclub_ads" target="_blank" class="btn-solid" style="background:#0088cc;border-color:#0088cc;padding:10px 18px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
                      <span>Open Chat with @bullclub_ads →</span>
                    </a>
                    <button type="button" class="btn-subtle" onclick="copyOrderMessage()" style="padding:10px 14px;font-size:13px;cursor:pointer;">
                      Copy Order Message
                    </button>
                  </div>
                  <label style="font-size:11px;color:var(--text-faint);display:block;margin-bottom:4px;">Pre-formatted Message for Admin:</label>
                  <textarea id="tgMessageText" readonly style="width:100%;height:105px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:monospace;font-size:11px;color:var(--ink);resize:none;box-sizing:border-box;"></textarea>

                  <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);">
                    <span style="color:#0088cc;font-weight:700;">Note:</span>
                    <span>Direct clearance with our admin desk: Send the message above to <b>@bullclub_ads</b> to complete manual payment and launch your campaign immediately.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PREVIEW COLUMN -->
          <div class="promote-col-preview">
            <div style="position:sticky;top:20px;">
              <h3 style="margin:0 0 .75rem;font-size:1.05rem;color:var(--ink);">Live Promoted Card Preview</h3>
              <p style="font-size:12px;color:var(--text-muted);margin:0 0 1rem;">This is how your promoted token will look on the homepage.</p>
              
              <div id="previewCardWrap">
                <div class="promoted-card" style="border:1px solid var(--gold);box-shadow:0 0 15px rgba(245,166,35,0.15);">
                  <div class="promoted-card-main">
                    <img id="prevLogo" class="promoted-logo" src="assets/logo-transparent.png" alt="Preview Logo" onerror="this.onerror=null; this.src='assets/logo-transparent.png';">
                    <div class="promoted-card-identity">
                      <div class="promoted-name-row">
                        <span id="prevName" class="promoted-name" title="Token Name">Token Name</span>
                        <span class="badge-promoted">PROMOTED</span>
                      </div>
                      <div class="promoted-card-actions">
                        <span id="prevChain" style="font-size:11px;color:var(--text-faint);text-transform:uppercase;">BSC</span>
                        <a id="prevTradeBtn" href="#" target="_blank" class="btn-promoted-trade" title="Trade directly on DEX">Trade ↗</a>
                      </div>
                    </div>
                  </div>
                  <div class="promoted-card-metrics">
                    <div class="promoted-price">$0.000100</div>
                    <div style="color:var(--up);">+12.4%</div>
                    <div id="prevSocials" class="promoted-socials">
                      <span style="color:var(--text-faint);font-size:11px;">—</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style="margin-top:1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;">
                <h4 style="margin:0 0 .5rem;font-size:12px;color:var(--ink);text-transform:uppercase;letter-spacing:0.5px;">Package Inclusions:</h4>
                <ul style="margin:0;padding-left:1.2rem;font-size:12px;color:var(--text-muted);line-height:1.6;">
                  <li>Top Homepage Carousel Placement</li>
                  <li>Exclusive Promoted Spotlight Grid</li>
                  <li>1-Click Verified DEX Trading Button</li>
                  <li>Live Social Links: Website, 𝕏, Telegram, Reddit</li>
                  <li>Priority Telegram Desk Clearance & Fast Launch</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 2: BANNER ADVERTISING -->
      <div id="promoteBannerSection" style="display:${isBannerMode ? 'block' : 'none'};">
        <div class="promote-grid-layout">
          <!-- BANNER FORM COLUMN -->
          <div class="promote-col-form">
            <form id="bannerForm" class="promote-form" onsubmit="event.preventDefault(); submitBannerOrder();">
              <h3 style="margin:0 0 1rem;font-size:1.1rem;color:var(--ink);">1. Campaign Information</h3>
              <div class="form-group">
                <label for="bTitle">Campaign / Brand Title *</label>
                <input type="text" id="bTitle" placeholder="e.g. DexSwap — Zero Slippage Meme Trading" required>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label for="bTargetUrl">Destination Website / DEX URL *</label>
                  <input type="url" id="bTargetUrl" placeholder="https://yourdomain.com or DEX link" required>
                </div>
                <div class="form-group">
                  <label for="bCtaText">CTA Button Text *</label>
                  <input type="text" id="bCtaText" placeholder="e.g. Trade Now →" value="Trade Now →" required>
                </div>
              </div>

              <div class="form-group">
                <label for="bDesc">Short Subtitle / Description (Optional)</label>
                <input type="text" id="bDesc" placeholder="e.g. Instant multi-chain swaps, deep liquidity & verified contracts.">
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">2. Banner Creative / Logo Image *</h3>
              <div class="form-group">
                <div id="bannerUploadDropzone" style="border:2px dashed var(--line);border-radius:10px;padding:1.25rem;text-align:center;background:var(--bg-panel-raised);cursor:pointer;transition:all 0.2s ease;" onclick="document.getElementById('bLogoFileInput').click()">
                  <input type="file" id="bLogoFileInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;" onchange="handleBannerFileUpload(event)">
                  <div id="bannerUploadPlaceholder">
                    <div style="margin-bottom:6px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                    <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:2px;">
                      Click to Upload Creative Graphic <span style="color:var(--gold);">or Drag & Drop</span>
                    </div>
                    <div style="font-size:11px;color:var(--ink-dim);">
                      Supports 728x90, 970x90, or project logo icon (PNG, JPG, WebP, SVG up to 5MB)
                    </div>
                  </div>
                  <div id="bannerUploadPreviewWrap" style="display:none;align-items:center;justify-content:center;gap:12px;">
                    <img id="bannerUploadThumb" src="" alt="Banner preview" style="width:54px;height:54px;border-radius:8px;object-fit:cover;border:2px solid var(--gold);">
                    <div style="text-align:left;">
                      <div id="bannerUploadFileName" style="font-size:13px;font-weight:700;color:var(--ink);">creative.png</div>
                      <div style="font-size:11px;color:var(--up);font-weight:600;">✓ Creative Ready <span style="color:var(--ink-dim);font-weight:normal;margin-left:6px;text-decoration:underline;cursor:pointer;">(Change)</span></div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                  <button type="button" class="btn-ghost" onclick="toggleBannerUrlField()" style="font-size:11px;padding:2px 6px;text-decoration:underline;cursor:pointer;border:none;background:none;color:var(--ink-dim);">
                    Or enter Image URL manually
                  </button>
                  <span id="bannerUploadStatus" style="font-size:11px;color:var(--ink-dim);"></span>
                </div>
                <div id="bannerUrlFieldWrap" style="display:none;margin-top:8px;">
                  <input type="text" id="bImageUrl" placeholder="https://yourdomain.com/banner.png" style="font-size:12px;width:100%;box-sizing:border-box;">
                </div>
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">3. Select Banner Placement & Duration</h3>
              <div class="package-selector" id="bPkgSelector">
                <div class="package-card ${bannerOrderState.selectedPkg === 'banner_slot_1' ? 'is-selected' : ''}" data-key="banner_slot_1" data-placement="top_banner_1" data-price="149" data-days="7">
                  <div style="font-weight:700;font-size:13px;color:var(--ink);">Slot 1 (Left)</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$149</div>
                  <div style="font-size:11px;color:var(--ink-dim);">7 Days • 3:1 Banner</div>
                </div>
                <div class="package-card ${bannerOrderState.selectedPkg === 'banner_slot_2' ? 'is-selected' : ''}" data-key="banner_slot_2" data-placement="top_banner_2" data-price="199" data-days="7">
                  <span class="pkg-badge">CENTER PRIME</span>
                  <div style="font-weight:700;font-size:13px;color:var(--ink);">Slot 2 (Center)</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$199</div>
                  <div style="font-size:11px;color:var(--ink-dim);">7 Days • Prime Eye-Level</div>
                </div>
                <div class="package-card ${bannerOrderState.selectedPkg === 'banner_slot_3' ? 'is-selected' : ''}" data-key="banner_slot_3" data-placement="top_banner_3" data-price="149" data-days="7">
                  <div style="font-weight:700;font-size:13px;color:var(--ink);">Slot 3 (Right)</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$149</div>
                  <div style="font-size:11px;color:var(--ink-dim);">7 Days • 3:1 Banner</div>
                </div>
                <div class="package-card ${bannerOrderState.selectedPkg === 'banner_bundle_30d' ? 'is-selected' : ''}" data-key="banner_bundle_30d" data-placement="top_banner_2" data-price="499" data-days="30">
                  <span class="pkg-badge" style="background:#00E5FF;">VIP</span>
                  <div style="font-weight:700;font-size:13px;color:var(--ink);">30-Day VIP</div>
                  <div style="font-size:1.25rem;font-weight:800;color:var(--gold);margin:4px 0;">$499</div>
                  <div style="font-size:11px;color:var(--ink-dim);">30 Days Center Domination</div>
                </div>
              </div>

              <h3 style="margin:1.75rem 0 0.5rem;font-size:1.1rem;color:var(--ink);">4. Payment & Activation</h3>
              <div style="background:rgba(0,136,204,0.08);border:1px solid rgba(0,136,204,0.25);border-radius:10px;padding:1rem;margin-bottom:1.25rem;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#0088cc" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  <div>
                    <div style="color:var(--ink);font-size:13px;font-weight:700;">Official Telegram Ad Desk: <a href="https://t.me/bullclub_ads" target="_blank" style="color:#0088cc;text-decoration:underline;">@bullclub_ads</a></div>
                    <div style="font-size:12px;color:var(--ink-dim);margin-top:2px;">
                      Fast direct clearance via official Telegram desk. Accepted: USDT (BEP20 / TRC20 / ERC20), SOL, BNB or On-Chain.
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" id="btnCreateBannerOrder" class="btn-solid" style="width:100%;padding:13px 12px;font-size:14px;cursor:pointer;background:#0088cc;border-color:#0088cc;display:flex;align-items:center;justify-content:center;gap:8px;white-space:normal;text-align:center;box-sizing:border-box;">
                <span style="white-space:normal;word-break:break-word;">Book via Telegram @bullclub_ads ($${bannerOrderState.price} USDT) →</span>
              </button>
            </form>

            <!-- BANNER ORDER PAYMENT / TELEGRAM CLEARANCE MODAL -->
            <div id="bannerPaymentArea" style="display:none;margin-top:1.5rem;border-top:1px solid var(--line);padding-top:1.5rem;">
              <div style="background:rgba(0,136,204,0.06);border:1px solid rgba(0,136,204,0.3);border-radius:10px;padding:1.4rem;margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
                  <span style="font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;">BANNER AD ORDER <span id="dispBannerOrderId" style="color:#0088cc;">#BT-BN-100</span></span>
                  <span style="background:rgba(242,169,59,0.15);color:var(--gold);border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;">Awaiting Payment Clearance</span>
                </div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--ink);margin-bottom:6px;">
                  Amount: <span style="color:var(--up);" id="dispBannerAmount">$${bannerOrderState.price} USDT</span>
                </div>
                <p style="font-size:13px;color:var(--ink-dim);margin:0 0 14px;line-height:1.5;">
                  Your banner slot is reserved in our ad engine! Contact our official Telegram desk <b>@bullclub_ads</b> with your order details for instant clearance and live activation.
                </p>

                <div style="background:var(--bg-panel);border:1px solid var(--line);border-radius:8px;padding:1.15rem;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;">Official Telegram Desk</span>
                    <span style="font-size:12px;color:#0088cc;font-weight:600;">@bullclub_ads</span>
                  </div>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                    <a id="btnOpenBannerTgChat" href="https://t.me/bullclub_ads" target="_blank" class="btn-solid" style="background:#0088cc;border-color:#0088cc;padding:10px 18px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
                      <span>Open Chat with @bullclub_ads →</span>
                    </a>
                    <button type="button" class="btn-subtle" onclick="copyBannerOrderMessage()" style="padding:10px 14px;font-size:13px;cursor:pointer;">
                      Copy Order Message
                    </button>
                  </div>
                  <label style="font-size:11px;color:var(--ink-faint);display:block;margin-bottom:4px;">Pre-formatted Message for Admin:</label>
                  <textarea id="tgBannerMessageText" readonly style="width:100%;height:105px;background:var(--bg-page);border:1px solid var(--line);border-radius:6px;padding:8px 10px;font-family:monospace;font-size:11px;color:var(--ink);resize:none;box-sizing:border-box;"></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- BANNER PREVIEW COLUMN -->
          <div class="promote-col-preview">
            <div style="position:sticky;top:20px;">
              <h3 style="margin:0 0 .75rem;font-size:1.05rem;color:var(--ink);">Live 3-Slot Trio Grid Preview</h3>
              <p style="font-size:12px;color:var(--ink-dim);margin:0 0 1rem;">This is how your banner appears in the top 3-column leaderboard above Promoted Tokens.</p>

              <div id="prevBannerWrap" style="margin-bottom:1.5rem;">
                <div class="banner-preview-trio" id="bannerPreviewTrio">
                  <!-- Slot 1 (Left) -->
                  <div class="banner-preview-slot ${bannerOrderState.placement === 'top_banner_1' ? 'is-selected' : ''}" id="prevSlot1">
                    <img class="banner-preview-slot-img" id="prevSlot1Img" src="${bannerOrderState.placement === 'top_banner_1' && bannerOrderState.bannerImage ? bannerOrderState.bannerImage : 'assets/banners/banner_meme_launch.svg'}" alt="Slot 1 preview" />
                    <div class="banner-preview-slot-content">
                      <span class="banner-preview-slot-badge" id="badgeSlot1">${bannerOrderState.placement === 'top_banner_1' ? 'SLOT 1 (SELECTED)' : 'SLOT 1 (LEFT)'}</span>
                      <div class="banner-preview-slot-title" id="titleSlot1">${bannerOrderState.placement === 'top_banner_1' ? 'Bulls Meme Launchpad' : 'Meme Launchpad'}</div>
                      <div class="banner-preview-slot-cta" id="ctaSlot1">${bannerOrderState.placement === 'top_banner_1' ? 'Target: https://yourdomain.com' : 'Book Slot 1 ($149/7D)'}</div>
                    </div>
                  </div>

                  <!-- Slot 2 (Center Prime) -->
                  <div class="banner-preview-slot ${bannerOrderState.placement === 'top_banner_2' ? 'is-selected' : ''}" id="prevSlot2">
                    <img class="banner-preview-slot-img" id="prevSlot2Img" src="${bannerOrderState.placement === 'top_banner_2' && bannerOrderState.bannerImage ? bannerOrderState.bannerImage : 'assets/banners/banner_minotaur_presale.svg'}" alt="Slot 2 preview" />
                    <div class="banner-preview-slot-content">
                      <span class="banner-preview-slot-badge" id="badgeSlot2">${bannerOrderState.placement === 'top_banner_2' ? 'SLOT 2 (SELECTED)' : 'SLOT 2 (CENTER)'}</span>
                      <div class="banner-preview-slot-title" id="titleSlot2">${bannerOrderState.placement === 'top_banner_2' ? 'Minotaur Bull Presale' : 'Center Prime Presale'}</div>
                      <div class="banner-preview-slot-cta" id="ctaSlot2">${bannerOrderState.placement === 'top_banner_2' ? 'Target: https://yourdomain.com' : 'Book Slot 2 ($199/7D)'}</div>
                    </div>
                  </div>

                  <!-- Slot 3 (Right) -->
                  <div class="banner-preview-slot ${bannerOrderState.placement === 'top_banner_3' ? 'is-selected' : ''}" id="prevSlot3">
                    <img class="banner-preview-slot-img" id="prevSlot3Img" src="${bannerOrderState.placement === 'top_banner_3' && bannerOrderState.bannerImage ? bannerOrderState.bannerImage : 'assets/banners/banner_solana_calls.svg'}" alt="Slot 3 preview" />
                    <div class="banner-preview-slot-content">
                      <span class="banner-preview-slot-badge" id="badgeSlot3">${bannerOrderState.placement === 'top_banner_3' ? 'SLOT 3 (SELECTED)' : 'SLOT 3 (RIGHT)'}</span>
                      <div class="banner-preview-slot-title" id="titleSlot3">${bannerOrderState.placement === 'top_banner_3' ? 'Solana Alpha Calls' : 'Alpha Calls & Signals'}</div>
                      <div class="banner-preview-slot-cta" id="ctaSlot3">${bannerOrderState.placement === 'top_banner_3' ? 'Target: https://yourdomain.com' : 'Book Slot 3 ($149/7D)'}</div>
                    </div>
                  </div>
                </div>

                <!-- Hidden backward-compatibility elements -->
                <div style="display:none;" aria-hidden="true">
                  <span id="prevSlotIndicatorBadge">SLOT 2 (CENTER PRIME) SELECTED</span>
                  <div id="prevBannerTitle">Minotaur Bull Presale</div>
                  <div id="prevBannerCta">Target: https://yourdomain.com</div>
                  <img id="prevBannerImg" src="assets/banners/banner_minotaur_presale.svg" alt="Banner preview" />
                </div>
              </div>

              <div style="background:var(--bg-panel);border:1px solid var(--line);border-radius:8px;padding:1rem;">
                <h4 style="margin:0 0 .5rem;font-size:12px;color:var(--ink);text-transform:uppercase;letter-spacing:0.5px;">Trio Banner Inclusions:</h4>
                <ul style="margin:0;padding-left:1.2rem;font-size:12px;color:var(--ink-dim);line-height:1.6;">
                  <li>High-conversion prime placement above Promoted Tokens</li>
                  <li>Side-by-side 3-column layout matching Top100Token reference</li>
                  <li>Fully responsive (3 cols desktop, 2 cols tablet, 1 col mobile)</li>
                  <li>Live click attribution & impression metrics</li>
                  <li>Direct link to your Web3 project, presale, DEX, or community</li>
                  <li>Priority Telegram desk verification & fast live activation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initPromotePreviewHandlers();
  initBannerHandlers();
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
      prevTradeBtn.textContent = `${dexLabel} ↗`;
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

  // Logo upload dropzone drag & drop support
  const dropzone = document.getElementById('logoUploadDropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--gold)';
        dropzone.style.background = 'rgba(245,166,35,0.08)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--border)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt?.files?.[0];
      if (file) processLogoFile(file);
    }, false);
  }

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
        btnCreateOrder.innerHTML = `<span>Book via Telegram @bullclub_ads ($${promoteOrderState.price} USDT) →</span>`;
      }
      const dispAmount = document.getElementById('dispAmount');
      if (dispAmount) dispAmount.textContent = `$${promoteOrderState.price} USDT`;
    });
  });
}

function handleLogoFileUpload(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  processLogoFile(file);
}

function processLogoFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WebP, SVG).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size exceeds 5MB limit. Please choose a smaller image.');
    return;
  }

  const reader = new FileReader();
  const statusEl = document.getElementById('logoUploadStatus');
  if (statusEl) statusEl.textContent = 'Processing image…';

  reader.onload = async function(evt) {
    const dataUrl = evt.target.result;
    
    // Update local preview thumbnail & info
    const thumb = document.getElementById('logoUploadThumb');
    const placeholder = document.getElementById('logoUploadPlaceholder');
    const previewWrap = document.getElementById('logoUploadPreviewWrap');
    const fileNameEl = document.getElementById('logoUploadFileName');
    const prevLogo = document.getElementById('prevLogo');
    const pLogoInput = document.getElementById('pLogo');

    if (thumb) thumb.src = dataUrl;
    if (placeholder) placeholder.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'flex';
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (prevLogo) prevLogo.src = dataUrl;
    if (pLogoInput) pLogoInput.value = dataUrl;

    if (statusEl) statusEl.textContent = 'Uploading to server…';

    try {
      const res = await fetchApi('/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          filename: file.name
        })
      });

      if (res.success && res.url) {
        if (pLogoInput) pLogoInput.value = res.url;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--up);">✓ Uploaded</span>';
      }
    } catch (err) {
      console.warn('[Logo Upload Notice] Stored as data URL:', err.message);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--up);">✓ Ready</span>';
    }
  };

  reader.readAsDataURL(file);
}

function toggleLogoUrlField() {
  const wrap = document.getElementById('logoUrlFieldWrap');
  if (wrap) {
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
    if (wrap.style.display === 'block') {
      document.getElementById('pLogo')?.focus();
    }
  }
}

async function submitPromotionOrder() {
  const btn = document.getElementById('btnCreateOrder');
  const logoVal = document.getElementById('pLogo')?.value.trim();

  if (!logoVal) {
    alert('Please upload a token logo image or provide a logo URL.');
    return;
  }

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
      logoUrl: logoVal,
      websiteUrl: document.getElementById('pWeb').value.trim() || null,
      xUrl: document.getElementById('pX').value.trim() || null,
      telegramUrl: document.getElementById('pTg').value.trim() || null,
      redditUrl: document.getElementById('pReddit').value.trim() || null,
      packageKey: promoteOrderState.selectedPkg,
      price: promoteOrderState.price,
      durationDays: promoteOrderState.days,
      paymentMethod: 'telegram_manual'
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

    const orderNum = `#BT-${res.orderId}`;
    const dispOrderId = document.getElementById('dispOrderId');
    if (dispOrderId) dispOrderId.textContent = orderNum;
    
    const dispAmount = document.getElementById('dispAmount');
    if (dispAmount) dispAmount.textContent = `$${res.price} USDT`;

    // Construct Telegram direct message
    const durationLabel = promoteOrderState.selectedPkg === '12H' ? '12 Hours' : (promoteOrderState.days === 1 ? '1 Day' : `${promoteOrderState.days} Days`);
    const tgMessage = `Hello Admin (@bullclub_ads)! I want to book promotion for my token on Bulls Traking:\n\n• Order ID: ${orderNum}\n• Token: ${payload.tokenName} (${payload.tokenSymbol})\n• Chain: ${payload.chain.toUpperCase()}\n• Contract: ${payload.contractAddress}\n• Package: ${promoteOrderState.selectedPkg} (${durationLabel} - $${res.price} USDT)\n\nPlease provide your payment address to clear this order.`;

    const tgMessageText = document.getElementById('tgMessageText');
    if (tgMessageText) tgMessageText.value = tgMessage;

    const btnOpenTg = document.getElementById('btnOpenTgChat');
    if (btnOpenTg) {
      btnOpenTg.href = `https://t.me/bullclub_ads?text=${encodeURIComponent(tgMessage)}`;
    }

    if (btn) {
      btn.style.display = 'none';
    }

    // Smooth scroll down to payment area
    paymentArea.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Error creating order: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Book via Telegram @bullclub_ads ($${promoteOrderState.price} USDT) →</span>`;
    }
  }
}

function copyOrderMessage() {
  const text = document.getElementById('tgMessageText')?.value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('Order details copied to clipboard! Send this message to @bullclub_ads on Telegram.');
  }).catch(() => {
    prompt('Copy order details:', text);
  });
}

/* ---------------- Banner Advertising Handlers ---------------- */

function initBannerHandlers() {
  const bTitle = document.getElementById('bTitle');
  const bTargetUrl = document.getElementById('bTargetUrl');
  const bCtaText = document.getElementById('bCtaText');
  const bDesc = document.getElementById('bDesc');
  const bImageUrl = document.getElementById('bImageUrl');

  const prevSlotIndicatorBadge = document.getElementById('prevSlotIndicatorBadge');
  const btnCreateBannerOrder = document.getElementById('btnCreateBannerOrder');
  const prevBannerTitle = document.getElementById('prevBannerTitle');
  const prevBannerDesc = document.getElementById('prevBannerDesc');
  const prevBannerCta = document.getElementById('prevBannerCta');
  const prevBannerImg = document.getElementById('prevBannerImg');
  const prevBannerIcon = document.getElementById('prevBannerIcon');
  const slotGraphicDefaults = {
    'top_banner_1': 'assets/banners/banner_meme_launch.svg',
    'top_banner_2': 'assets/banners/banner_minotaur_presale.svg',
    'top_banner_3': 'assets/banners/banner_solana_calls.svg'
  };

  const slotBadgeLabels = {
    'banner_slot_1': 'SLOT 1 (LEFT) SELECTED',
    'banner_slot_2': 'SLOT 2 (CENTER PRIME) SELECTED',
    'banner_slot_3': 'SLOT 3 (RIGHT) SELECTED',
    'banner_bundle_30d': '30-DAY VIP LEADERBOARD SELECTED'
  };

  function updateBannerPreview() {
    const titleVal = bTitle && bTitle.value.trim() ? bTitle.value.trim() : '';
    const targetVal = bTargetUrl && bTargetUrl.value.trim() ? bTargetUrl.value.trim() : 'https://yourdomain.com';
    const imgVal = (bImageUrl && bImageUrl.value.trim()) ? bImageUrl.value.trim() : (bannerOrderState.bannerImage || '');
    const activePlacement = bannerOrderState.placement || 'top_banner_2';

    if (prevSlotIndicatorBadge) {
      prevSlotIndicatorBadge.textContent = slotBadgeLabels[bannerOrderState.selectedPkg] || 'SPONSORED BANNER';
    }
    if (prevBannerTitle) {
      prevBannerTitle.textContent = titleVal || (bannerOrderState.selectedPkg === 'banner_slot_1' ? 'Bulls Meme Launchpad' : (bannerOrderState.selectedPkg === 'banner_slot_3' ? 'Solana Alpha Calls' : 'Minotaur Bull Presale'));
    }
    if (prevBannerCta) {
      prevBannerCta.textContent = `Target: ${targetVal}`;
    }
    if (prevBannerImg) {
      const defaultImg = slotGraphicDefaults[activePlacement] || 'assets/banners/banner_minotaur_presale.svg';
      prevBannerImg.src = imgVal || defaultImg;
      prevBannerImg.style.display = 'block';
    }

    // Update 3-Slot Trio Grid slots in the preview column
    const previewSlots = [
      { slotNum: 1, placement: 'top_banner_1', defTitle: 'Bulls Meme Launchpad', defCta: 'Book Slot 1 ($149/7D)', defImg: 'assets/banners/banner_meme_launch.svg' },
      { slotNum: 2, placement: 'top_banner_2', defTitle: 'Minotaur Bull Presale', defCta: 'Book Slot 2 ($199/7D)', defImg: 'assets/banners/banner_minotaur_presale.svg' },
      { slotNum: 3, placement: 'top_banner_3', defTitle: 'Solana Alpha Calls', defCta: 'Book Slot 3 ($149/7D)', defImg: 'assets/banners/banner_solana_calls.svg' }
    ];

    previewSlots.forEach(({ slotNum, placement, defTitle, defCta, defImg }) => {
      const slotEl = document.getElementById(`prevSlot${slotNum}`);
      const imgEl = document.getElementById(`prevSlot${slotNum}Img`);
      const badgeEl = document.getElementById(`badgeSlot${slotNum}`);
      const titleEl = document.getElementById(`titleSlot${slotNum}`);
      const ctaEl = document.getElementById(`ctaSlot${slotNum}`);

      const isSelected = (activePlacement === placement);
      if (slotEl) {
        if (isSelected) {
          slotEl.classList.add('is-selected');
        } else {
          slotEl.classList.remove('is-selected');
        }
      }
      if (badgeEl) {
        badgeEl.textContent = isSelected ? `SLOT ${slotNum} (SELECTED)` : `SLOT ${slotNum} (${slotNum === 1 ? 'LEFT' : slotNum === 2 ? 'CENTER' : 'RIGHT'})`;
      }
      if (titleEl) {
        titleEl.textContent = isSelected ? (titleVal || defTitle) : defTitle;
      }
      if (ctaEl) {
        ctaEl.textContent = isSelected ? `Target: ${targetVal}` : defCta;
      }
      if (imgEl) {
        imgEl.src = isSelected ? (imgVal || defImg) : defImg;
      }
    });
  }

  [bTitle, bTargetUrl, bCtaText, bDesc, bImageUrl].forEach(el => {
    if (el) el.addEventListener('input', updateBannerPreview);
  });

  // Banner package selector
  const bCards = document.querySelectorAll('#bPkgSelector .package-card');
  bCards.forEach(card => {
    card.addEventListener('click', () => {
      bCards.forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      bannerOrderState.selectedPkg = card.dataset.key;
      bannerOrderState.placement = card.dataset.placement || 'top_banner_2';
      bannerOrderState.price = Number(card.dataset.price);
      bannerOrderState.days = Number(card.dataset.days);
      if (btnCreateBannerOrder) {
        btnCreateBannerOrder.innerHTML = `<span>Book via Telegram @bullclub_ads ($${bannerOrderState.price} USDT) →</span>`;
      }
      const dispBannerAmount = document.getElementById('dispBannerAmount');
      if (dispBannerAmount) dispBannerAmount.textContent = `$${bannerOrderState.price} USDT`;
      updateBannerPreview();
    });
  });

  // Dropzone drag & drop support
  const bDropzone = document.getElementById('bannerUploadDropzone');
  if (bDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      bDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bDropzone.style.borderColor = 'var(--gold)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      bDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bDropzone.style.borderColor = 'var(--line)';
      }, false);
    });

    bDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt?.files?.[0];
      if (file) processBannerFile(file);
    }, false);
  }
}

function handleBannerFileUpload(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  processBannerFile(file);
}
window.handleBannerFileUpload = handleBannerFileUpload;

function processBannerFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WebP, SVG).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image size exceeds 5MB limit. Please choose a smaller image.');
    return;
  }

  const reader = new FileReader();
  const statusEl = document.getElementById('bannerUploadStatus');
  if (statusEl) statusEl.textContent = 'Processing image…';

  reader.onload = async function(evt) {
    const dataUrl = evt.target.result;
    const thumb = document.getElementById('bannerUploadThumb');
    const placeholder = document.getElementById('bannerUploadPlaceholder');
    const previewWrap = document.getElementById('bannerUploadPreviewWrap');
    const fileNameEl = document.getElementById('bannerUploadFileName');
    const bImageUrl = document.getElementById('bImageUrl');
    const prevBannerImg = document.getElementById('prevBannerImg');
    const prevBannerIcon = document.getElementById('prevBannerIcon');

    if (thumb) thumb.src = dataUrl;
    if (placeholder) placeholder.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'flex';
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (bImageUrl) bImageUrl.value = dataUrl;
    if (prevBannerImg) {
      prevBannerImg.src = dataUrl;
      prevBannerImg.style.display = 'block';
    }
    if (prevBannerIcon) prevBannerIcon.style.display = 'none';

    if (statusEl) statusEl.textContent = 'Uploading to server…';

    try {
      const res = await fetchApi('/upload-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          filename: file.name
        })
      });

      if (res.success && res.url) {
        if (bImageUrl) bImageUrl.value = res.url;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--up);">✓ Uploaded</span>';
      }
    } catch (err) {
      console.warn('[Banner Upload Notice] Stored as data URL:', err.message);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--up);">✓ Ready</span>';
    }
  };

  reader.readAsDataURL(file);
}

function toggleBannerUrlField() {
  const wrap = document.getElementById('bannerUrlFieldWrap');
  if (wrap) {
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
    if (wrap.style.display === 'block') {
      document.getElementById('bImageUrl')?.focus();
    }
  }
}
window.toggleBannerUrlField = toggleBannerUrlField;

async function submitBannerOrder() {
  const btn = document.getElementById('btnCreateBannerOrder');
  const title = document.getElementById('bTitle')?.value.trim();
  const targetUrl = document.getElementById('bTargetUrl')?.value.trim();
  const imageUrl = document.getElementById('bImageUrl')?.value.trim() || 'assets/logo-transparent.png';
  const ctaText = document.getElementById('bCtaText')?.value.trim() || 'Trade Now →';

  if (!title || !targetUrl) {
    alert('Please provide both a Campaign Title and Destination URL.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Booking Banner Campaign…';
  }

  try {
    const payload = {
      title,
      targetUrl,
      bannerImage: imageUrl,
      banner_url: imageUrl,
      placement: bannerOrderState.placement,
      packageId: bannerOrderState.selectedPkg,
      ctaText
    };

    const res = await fetchApi('/banners/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.success || !res.data) throw new Error(res.error || 'Failed to register banner order.');

    bannerOrderState.activeOrder = res.data;
    const paymentArea = document.getElementById('bannerPaymentArea');
    if (paymentArea) paymentArea.style.display = 'block';

    const orderNum = `#BT-BN-${res.data.id}`;
    const dispOrderId = document.getElementById('dispBannerOrderId');
    if (dispOrderId) dispOrderId.textContent = orderNum;

    const serverPrice = res.data.price || bannerOrderState.price;
    const serverDuration = res.data.durationDays || res.data.duration || bannerOrderState.days;

    const dispAmount = document.getElementById('dispBannerAmount');
    if (dispAmount) dispAmount.textContent = `$${serverPrice} USDT`;

    const slotLabels = {
      'top_banner_1': 'Top Leaderboard Slot 1 (Left - $149/7D)',
      'top_banner_2': serverDuration === 30 ? 'Top Leaderboard Slot 2 (Center VIP - $499/30D)' : 'Top Leaderboard Slot 2 (Center Prime - $199/7D)',
      'top_banner_3': 'Top Leaderboard Slot 3 (Right - $149/7D)',
      'homepage_banner': 'Homepage In-Feed Spotlight ($299/7D)'
    };
    const slotName = slotLabels[bannerOrderState.placement] || bannerOrderState.placement;

    const tgMessage = `Hello Admin (@bullclub_ads)! I want to book a Banner Advertisement on Bulls Traking:\n\n• Order ID: ${orderNum}\n• Campaign: ${payload.title}\n• Slot Placement: ${slotName}\n• Duration: ${serverDuration} Days ($${serverPrice} USDT)\n• Target URL: ${payload.targetUrl}\n• CTA Text: ${ctaText}\n\nPlease provide your payment address to verify and activate this banner placement.`;

    const tgMessageText = document.getElementById('tgBannerMessageText');
    if (tgMessageText) tgMessageText.value = tgMessage;

    const btnOpenTg = document.getElementById('btnOpenBannerTgChat');
    if (btnOpenTg) {
      btnOpenTg.href = `https://t.me/bullclub_ads?text=${encodeURIComponent(tgMessage)}`;
    }

    if (btn) btn.style.display = 'none';

    paymentArea.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Error booking banner: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Book via Telegram @bullclub_ads ($${bannerOrderState.price} USDT) →</span>`;
    }
  }
}
window.submitBannerOrder = submitBannerOrder;

function copyBannerOrderMessage() {
  const text = document.getElementById('tgBannerMessageText')?.value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('Banner order message copied to clipboard! Send this message to @bullclub_ads on Telegram.');
  }).catch(() => {
    prompt('Copy banner order details:', text);
  });
}
window.copyBannerOrderMessage = copyBannerOrderMessage;


function copyTreasuryAddress() {
  const addr = document.getElementById('dispTreasuryAddr')?.textContent;
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => {
    const btn = document.getElementById('btnCopyTreasury');
    if (btn) {
      btn.textContent = 'Copied! ✓';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
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
            <b>Payment Verified!</b> Your promotion is now <b>LIVE</b> on Bulls Traking.<br>
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
      btn.textContent = 'Verify & Activate Now';
    }
  }
}

/* ---------------- 6b. ADMIN PORTAL VIEW (/admin) ---------------- */

let adminPortalState = {
  key: sessionStorage.getItem('bt_admin_key') || '',
  orders: []
};

async function renderAdminPage() {
  document.title = 'Admin Portal | Bulls Traking';
  
  if (!adminPortalState.key) {
    renderAdminLogin();
    return;
  }

  await loadAdminDashboard();
}

function renderAdminLogin(errorMsg = '') {
  app.innerHTML = `
    <div style="max-width:440px;margin:3.5rem auto;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:2rem;box-shadow:0 8px 32px rgba(0,0,0,0.35);">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <span style="display:inline-block;margin-bottom:6px;"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
        <h2 style="font-family:var(--display);margin:0.5rem 0 0.25rem;font-size:1.6rem;color:var(--ink);">Bulls Traking Admin</h2>
        <p style="font-size:13px;color:var(--text-muted);margin:0;">Promotion Clearance & Ad Activation Console</p>
      </div>

      ${errorMsg ? `<div style="background:rgba(235,87,87,0.12);color:var(--down);border:1px solid rgba(235,87,87,0.3);padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:1rem;text-align:center;">${escapeHtml(errorMsg)}</div>` : ''}

      <form id="adminLoginForm" onsubmit="event.preventDefault(); handleAdminLogin();">
        <div class="field" style="margin-bottom:1.25rem;">
          <label for="adminKeyInput" style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;color:var(--ink);">Admin Secret Key</label>
          <input type="password" id="adminKeyInput" placeholder="Enter admin secret password" required style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--border);color:var(--ink);border-radius:6px;box-sizing:border-box;">
        </div>

        <button type="submit" id="btnAdminLogin" class="btn-solid" style="width:100%;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">
          Enter Admin Portal →
        </button>
      </form>
    </div>
  `;
}

async function handleAdminLogin() {
  const input = document.getElementById('adminKeyInput');
  const btn = document.getElementById('btnAdminLogin');
  const key = input?.value.trim();
  if (!key) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }

  try {
    const res = await fetchApi('/admin/orders', {
      headers: { 'x-admin-key': key }
    });
    if (res.success) {
      adminPortalState.key = key;
      sessionStorage.setItem('bt_admin_key', key);
      await loadAdminDashboard();
    } else {
      throw new Error(res.error || 'Authentication failed');
    }
  } catch (err) {
    renderAdminLogin('Invalid Admin Key. Access denied.');
  }
}

function handleAdminLogout() {
  adminPortalState.key = '';
  sessionStorage.removeItem('bt_admin_key');
  renderAdminLogin();
}

async function loadAdminDashboard() {
  app.innerHTML = `
    <div style="max-width:1180px;margin:2rem auto;padding:0 1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:12px;">
        <div>
          <span style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.5px;">ADMINISTRATION CONSOLE</span>
          <h1 style="font-family:var(--display);margin:4px 0 0;font-size:1.8rem;color:var(--ink);">Promotion Orders & Ad Management</h1>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <a href="https://t.me/bullclub_ads" target="_blank" class="btn-subtle" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 14px;text-decoration:none;">
            <span>@bullclub_ads</span>
          </a>
          <button type="button" class="btn-subtle" onclick="loadAdminDashboard()" style="padding:8px 14px;font-size:13px;cursor:pointer;">
            Refresh
          </button>
          <button type="button" class="btn-ghost" onclick="handleAdminLogout()" style="padding:8px 14px;font-size:13px;cursor:pointer;color:var(--down);">
            Logout
          </button>
        </div>
      </div>

      <div id="adminNoticeArea"></div>

      <!-- STATS OVERVIEW CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;margin-bottom:1.5rem;" id="adminStatsArea">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.2rem;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Total Orders</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--ink);margin-top:4px;" id="statTotalOrders">—</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.2rem;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Pending Clearance</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--gold);margin-top:4px;" id="statPendingOrders">—</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.2rem;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Active Running Ads</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--up);margin-top:4px;" id="statActiveAds">—</div>
        </div>
      </div>

      <!-- ORDERS TABLE -->
      <div class="table-wrap" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow-x:auto;">
        <table class="data-table" style="width:100%;border-collapse:collapse;" id="adminOrdersTable">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left;font-size:12px;color:var(--text-muted);">
              <th style="padding:12px;">ORDER #</th>
              <th style="padding:12px;">TOKEN</th>
              <th style="padding:12px;">CHAIN / CA</th>
              <th style="padding:12px;">PACKAGE</th>
              <th style="padding:12px;">PRICE</th>
              <th style="padding:12px;">DATE</th>
              <th style="padding:12px;">STATUS</th>
              <th style="padding:12px;text-align:right;">ACTION</th>
            </tr>
          </thead>
          <tbody id="adminOrdersBody">
            <tr><td colspan="8" style="padding:2rem;text-align:center;color:var(--text-muted);">Loading orders…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await fetchApi('/admin/orders', {
      headers: { 'x-admin-key': adminPortalState.key }
    });

    const orders = res.data || [];
    adminPortalState.orders = orders;

    const total = orders.length;
    const pending = orders.filter(o => o.order_status !== 'active' && o.payment_status !== 'paid').length;
    const active = orders.filter(o => o.order_status === 'active').length;

    const elTotal = document.getElementById('statTotalOrders');
    const elPending = document.getElementById('statPendingOrders');
    const elActive = document.getElementById('statActiveAds');
    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elActive) elActive.textContent = active;

    const tbody = document.getElementById('adminOrdersBody');
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:2rem;text-align:center;color:var(--text-muted);">No promotion orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const isLive = order.order_status === 'active';
      const logo = order.logo_url || 'assets/logo-transparent.png';
      const tokenName = order.token_name || 'Unknown';
      const tokenSymbol = order.token_symbol || 'TOKEN';
      const chain = (order.chain || 'bsc').toUpperCase();
      const ca = order.contract_address || '';
      const caTrunc = ca ? `${ca.slice(0, 6)}...${ca.slice(-4)}` : 'N/A';
      const pkg = order.package_name || `${order.duration_days || 7} Days`;
      const price = `$${order.price || 0}`;
      const dateStr = fmtAge(order.created_at);

      let statusBadge = '';
      if (isLive) {
        statusBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:rgba(127,184,120,0.2);color:var(--up);border:1px solid rgba(127,184,120,0.4);">ACTIVE LIVE</span>`;
      } else if (order.payment_status === 'paid') {
        statusBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:rgba(0,136,204,0.2);color:#0088cc;border:1px solid rgba(0,136,204,0.4);">PAID</span>`;
      } else {
        statusBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:rgba(245,166,35,0.15);color:var(--gold);border:1px solid rgba(245,166,35,0.3);">PENDING</span>`;
      }

      let actionBtn = '';
      if (isLive) {
        actionBtn = `
          <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
            <a href="/#/promoted" target="_blank" class="btn-ghost" style="padding:6px 10px;font-size:12px;text-decoration:none;">
              View Ad ↗
            </a>
            <button type="button" class="btn-ghost" onclick="deleteOrderAdmin(${order.id})" title="Delete Order" style="padding:6px 10px;font-size:12px;color:var(--down);cursor:pointer;border-color:rgba(235,87,87,0.3);">
              Delete
            </button>
          </div>
        `;
      } else {
        actionBtn = `
          <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
            <button type="button" class="btn-solid" onclick="activateOrderAdmin(${order.id})" id="btnActOrder_${order.id}" style="padding:6px 12px;font-size:12px;background:var(--up);border-color:var(--up);color:#15130e;font-weight:700;cursor:pointer;">
              Approve & Run Ad
            </button>
            <button type="button" class="btn-ghost" onclick="deleteOrderAdmin(${order.id})" title="Delete Order" style="padding:6px 10px;font-size:12px;color:var(--down);cursor:pointer;border-color:rgba(235,87,87,0.3);">
              Delete
            </button>
          </div>
        `;
      }

      return `
        <tr style="border-bottom:1px solid var(--border);font-size:13px;" id="orderRow_${order.id}">
          <td style="padding:12px;font-weight:700;color:var(--ink);">#BT-${order.id}</td>
          <td style="padding:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${escapeHtml(logo)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.onerror=null; this.src='assets/logo-transparent.png';">
              <div>
                <div style="font-weight:700;color:var(--ink);">${escapeHtml(tokenName)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(tokenSymbol)}</div>
              </div>
            </div>
          </td>
          <td style="padding:12px;">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);">${escapeHtml(chain)}</span><br>
            <span style="font-family:monospace;font-size:11px;color:var(--text-faint);" title="${escapeHtml(ca)}">${escapeHtml(caTrunc)}</span>
          </td>
          <td style="padding:12px;color:var(--ink);font-weight:600;">${escapeHtml(pkg)}</td>
          <td style="padding:12px;font-weight:800;color:var(--up);">${price}</td>
          <td style="padding:12px;color:var(--text-muted);font-size:12px;">${dateStr}</td>
          <td style="padding:12px;">${statusBadge}</td>
          <td style="padding:12px;text-align:right;">${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('adminOrdersBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:2rem;text-align:center;color:var(--down);">Failed to load orders: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

async function activateOrderAdmin(orderId) {
  if (!confirm(`Are you sure you want to approve Order #BT-${orderId} and start running the promotion ad now?`)) {
    return;
  }

  const btn = document.getElementById(`btnActOrder_${orderId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Activating…';
  }

  try {
    const res = await fetchApi(`/admin/orders/${orderId}/activate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-key': adminPortalState.key 
      }
    });

    if (res.success) {
      const noticeArea = document.getElementById('adminNoticeArea');
      if (noticeArea) {
        noticeArea.innerHTML = `
          <div style="background:rgba(127,184,120,0.15);color:var(--up);border:1px solid rgba(127,184,120,0.3);padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
            <span><b>Order #BT-${orderId} Activated!</b> Token is now running live on homepage carousel, spotlight grid, and promoted section.</span>
            <a href="/#/promoted" target="_blank" style="color:var(--up);font-weight:700;margin-left:12px;">View Promoted Section →</a>
          </div>
        `;
      }
      await loadAdminDashboard();
    } else {
      throw new Error(res.error || 'Activation failed');
    }
  } catch (err) {
    alert(`Failed to activate order: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Approve & Run Ad';
    }
  }
}

async function deleteOrderAdmin(orderId) {
  if (!confirm(`Are you sure you want to permanently delete Order #BT-${orderId}? This will remove it from the admin queue.`)) {
    return;
  }

  try {
    const res = await fetchApi(`/admin/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-key': adminPortalState.key
      }
    });

    if (res.success) {
      const noticeArea = document.getElementById('adminNoticeArea');
      if (noticeArea) {
        noticeArea.innerHTML = `
          <div style="background:rgba(235,87,87,0.12);color:var(--down);border:1px solid rgba(235,87,87,0.3);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:1.5rem;">
            <b>Order #BT-${orderId} deleted successfully.</b>
          </div>
        `;
      }
      await loadAdminDashboard();
    } else {
      throw new Error(res.error || 'Failed to delete order');
    }
  } catch (err) {
    alert(`Failed to delete order: ${err.message}`);
  }
}

// Expose admin and promotion helper functions globally
window.copyOrderMessage = copyOrderMessage;
window.copyTreasuryAddress = copyTreasuryAddress;
window.verifyAndActivateOrder = verifyAndActivateOrder;
window.renderAdminPage = renderAdminPage;
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout;
window.loadAdminDashboard = loadAdminDashboard;
window.activateOrderAdmin = activateOrderAdmin;
window.deleteOrderAdmin = deleteOrderAdmin;
window.handleLogoFileUpload = handleLogoFileUpload;
window.toggleLogoUrlField = toggleLogoUrlField;
window.toggleMobileMenu = toggleMobileMenu;

/* ---------------- 7. PRESALES VIEW (Section 3 Placeholder) ---------------- */

function renderPresales() {
  app.innerHTML = `
    <div id="presaleBannerWrap" style="margin-bottom:1.25rem;"></div>
    <div class="placeholder-card">
      <h2>Presale Radar</h2>
      <p>Presale tracking is coming soon.</p>
    </div>
  `;
  renderSiteWideBanner('presaleBannerWrap', 'presale');
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
          <div class="field" style="max-width:140px;">
            <label>Symbol</label>
            <input type="text" name="tokenSymbol" placeholder="e.g. BULL" style="text-transform:uppercase;">
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

      // Save locally to localStorage for instant persistence across reloads/CDN
      try {
        const stored = JSON.parse(localStorage.getItem('bt_submitted_tokens') || '[]');
        const key = (res.contractAddress || data.contractAddress || '').toLowerCase();
        const filtered = stored.filter(t => (t.contract_address || '').toLowerCase() !== key);
        filtered.unshift({
          id: res.tokenId,
          name: res.name || data.projectName,
          symbol: res.symbol || data.projectName.slice(0, 5).toUpperCase(),
          chain: res.chain || data.chain,
          contract_address: res.contractAddress || data.contractAddress,
          logo_url: res.logoUrl || data.logoUrl || 'assets/logo-transparent.png',
          price: res.price || 0.0001,
          market_cap: res.marketCap || 25000,
          volume_24h: res.volume24h || 500,
          change_24h: 0,
          change_1h: 0,
          change_7d: 0,
          description: data.description || '',
          website_url: data.websiteUrl || '',
          x_url: data.xUrl || '',
          telegram_url: data.telegramUrl || '',
          first_seen_at: new Date().toISOString(),
          is_submitted: 1,
          listing_status: 'LIVE',
          verification_status: 'verified'
        });
        localStorage.setItem('bt_submitted_tokens', JSON.stringify(filtered.slice(0, 50)));
      } catch (e) {}

      // Section 12 Success Screen
      document.getElementById('submitFormCard').style.display = 'none';
      const container = document.getElementById('successScreenContainer');
      container.style.display = 'block';
      const tokenDisplayName = escapeHtml(res.name || data.projectName);
      const tokenDisplaySym = escapeHtml(res.symbol || data.projectName.slice(0, 5).toUpperCase());
      const tokenDisplayChain = escapeHtml(formatChainLabel(res.chain || data.chain));
      const tokenDisplayCA = escapeHtml(res.contractAddress || data.contractAddress);
      const targetId = res.tokenId || encodeURIComponent(res.contractAddress || data.contractAddress);

      container.innerHTML = `
        <div class="success-screen-card" style="text-align:center;padding:2.5rem 1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:580px;margin:2rem auto;">
          <div style="margin-bottom:1.2rem;display:flex;justify-content:center;"><div style="width:54px;height:54px;border-radius:50%;background:rgba(61,220,151,0.12);border:2px solid var(--up);display:flex;align-items:center;justify-content:center;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--up)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div></div>
          <h2 style="font-family:var(--display);font-size:1.8rem;margin:0 0 0.5rem;color:var(--ink);">Token Listed Successfully!</h2>
          <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(61,220,151,0.15);color:var(--up);border:1px solid rgba(61,220,151,0.3);margin-bottom:1.2rem;">
            LIVE ON BULLS TRAKING
          </div>
          <p style="color:var(--text-muted);font-size:14px;line-height:1.5;margin:0 auto 1.5rem;max-width:480px;">
            <b>${tokenDisplayName} ($${tokenDisplaySym})</b> has been verified and saved to the database. It is immediately discoverable in <b>New Coins</b> and accessible via search and direct URL.
          </p>

          <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:12px;margin:0 auto 1.8rem;text-align:left;font-size:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:var(--text-muted);">Chain:</span>
              <span style="font-weight:700;color:var(--ink);">${tokenDisplayChain}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span style="color:var(--text-muted);">Contract:</span>
              <code style="font-family:monospace;color:var(--cyan);word-break:break-all;font-size:11px;">${tokenDisplayCA}</code>
            </div>
          </div>

          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <a href="#/token/${targetId}" class="btn-solid" style="padding:0.75rem 1.8rem;font-size:14px;text-decoration:none;">
              View Token Detail ↗
            </a>
            <a href="#/new-coins" class="btn-ghost" style="padding:0.75rem 1.6rem;font-size:14px;text-decoration:none;">
              View in New Coins →
            </a>
          </div>

          <div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1rem;">
            <button type="button" onclick="location.reload()" class="btn-ghost" style="font-size:12px;padding:6px 12px;border:none;color:var(--text-muted);cursor:pointer;">
              + Submit Another Token
            </button>
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
    let t = null;
    try {
      const res = await fetchApi(`/tokens/${idOrAddress}`);
      t = res.data;
    } catch (fetchErr) {
      // Check local submitted tokens store as resilient fallback
      try {
        const local = JSON.parse(localStorage.getItem('bt_submitted_tokens') || '[]');
        t = local.find(x => String(x.id) === String(idOrAddress) || 
          (x.contract_address && x.contract_address.toLowerCase() === String(idOrAddress).toLowerCase()) ||
          (x.symbol && x.symbol.toLowerCase() === String(idOrAddress).toLowerCase())
        );
      } catch (e) {}
      if (!t) throw fetchErr;
    }

    const socials = [];
    const safeWeb = sanitizeUrl(t.website_url);
    if (safeWeb) socials.push(`<a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer sponsored">Website</a>`);
    const safeX = sanitizeUrl(t.x_url);
    if (safeX) socials.push(`<a href="${escapeHtml(safeX)}" target="_blank" rel="noopener noreferrer sponsored">X (Twitter)</a>`);
    const safeTg = sanitizeUrl(t.telegram_url);
    if (safeTg) socials.push(`<a href="${escapeHtml(safeTg)}" target="_blank" rel="noopener noreferrer sponsored">Telegram</a>`);

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
          </h1>
          <div style="font-size:12px;color:var(--text-faint);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>Contract: <code style="color:var(--cyan);">${escapeHtml(t.contract_address)}</code></span>
            <button onclick="navigator.clipboard.writeText('${escapeHtml(t.contract_address)}'); alert('Contract address copied!');" style="background:transparent;border:1px solid var(--line-light);color:var(--text-muted);font-size:11px;padding:2px 6px;border-radius:3px;">Copy</button>
            <span>(${escapeHtml(formatChainLabel(t.chain))})</span>
          </div>
        </div>
      </div>

      <div class="detail-price">${fmtPrice(t.price)} ${fmtChg(t.change_24h)}</div>

      <div id="tokenDetailBannerWrap" style="margin:1rem 0;"></div>

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

    renderSiteWideBanner('tokenDetailBannerWrap', 'token_detail');
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
const seenRadarPairIds = new Set();

async function renderNewPairs() {
  document.title = 'New Pairs Radar | Bulls Traking';
  if (newPairsState.tab === 'trending') newPairsState.tab = 'latest';
  app.innerHTML = `
    <div class="page-head" style="margin-bottom:1rem;">
      <h1 style="font-family:var(--display);margin:0;font-size:1.75rem;">New Pairs Radar</h1>
    </div>

    <!-- TABS CONTROLS -->
    <div class="controls-bar" style="margin-bottom:1.25rem;">
      <div class="subtabs" id="radarTabs">
        <span class="subtab ${newPairsState.tab === 'latest' ? 'is-active' : ''}" data-tab="latest">Latest (< 24h)</span>
        <span class="subtab ${newPairsState.tab === 'matured' ? 'is-active' : ''}" data-tab="matured">Matured (> 7d)</span>
      </div>
    </div>

    <!-- RADAR BANNER PLACEMENT -->
    <div id="radarBannerWrap" style="margin-bottom:1.25rem;"></div>

    <!-- PAIRS TABLE -->
    <div class="table-wrap">
      <table class="radar-table" id="radarTable">
        <thead>
          <tr>
            <th class="col-radar-rank col-rank">#</th>
            <th class="col-radar-token col-token">Token / Pool</th>
            <th class="col-radar-price col-price">Price</th>
            <th class="col-radar-liq col-lp">Liquidity</th>
            <th class="col-radar-vol col-vol">24h Volume</th>
            <th class="col-radar-txn">24h TXN</th>
            <th class="col-radar-age">Pair Age</th>
            <th class="col-radar-eco">Ecosystem</th>
            <th class="col-radar-actions col-actions">Actions</th>
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
    seenRadarPairIds.clear();
    renderNewPairs();
  });

  const btnRefresh = document.getElementById('btnRefreshRadar');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      newPairsState.page = 1;
      seenRadarPairIds.clear();
      loadRadarPairs(false, true);
    });
  }

  loadRadarPairs(false);
  renderSiteWideBanner('radarBannerWrap', 'radar');

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
  const chainLabel = formatChainLabel(p.chain);
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

  const safePoolUrl = sanitizeUrl(poolUrl);
  const safeTwitter = sanitizeUrl(p.twitter_url);
  const safeTg = sanitizeUrl(p.telegram_url);
  const safeWeb = sanitizeUrl(p.website_url);

  return `
    <tr data-pair-id="${escapeHtml(pairId)}" class="${rowClass}">
      <td class="col-radar-rank col-rank">${idx + 1}</td>
      <td class="col-radar-token col-token">
        <div class="token-cell">
          <img src="${escapeHtml(normalizeTokenLogo(p.logo_url, p.symbol, p.name))}" alt="${escapeHtml(p.symbol)}" onerror="this.onerror=null; this.src=getTokenFallbackAvatar('${escapeHtml(p.symbol)}', '${escapeHtml(p.name)}');">
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="token-name">${escapeHtml(p.name)}</span>
              ${badgeImg}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              <span class="token-sym">${escapeHtml(p.symbol)}</span>
              ${safeTwitter ? `<a href="${escapeHtml(safeTwitter)}" target="_blank" rel="noopener noreferrer sponsored" class="token-social-link" title="Twitter / X"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>` : ''}
              ${safeTg ? `<a href="${escapeHtml(safeTg)}" target="_blank" rel="noopener noreferrer sponsored" class="token-social-link" title="Telegram"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg></a>` : ''}
              ${safeWeb ? `<a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer sponsored" class="token-social-link" title="Website"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></a>` : ''}
            </div>
            <div class="radar-mobile-subinfo"><span class="pair-age-pill">${age}</span>${freshBadge}</div>
          </div>
        </div>
      </td>
      <td class="col-radar-price col-price"><b>${fmtPrice(p.price)}</b></td>
      <td class="col-radar-liq col-lp">${fmtUsd(p.liquidity)}</td>
      <td class="col-radar-vol col-vol">${fmtUsd(p.volume_24h)}</td>
      <td class="col-radar-txn">${txns}</td>
      <td class="col-radar-age"><span class="pair-age-pill">${age}</span>${freshBadge}</td>
      <td class="col-radar-eco"><span class="chain-badge chain-${escapeHtml(p.chain || '')}">${chainLabel}</span></td>
      <td class="col-radar-actions col-actions">
        <div>
          ${safePoolUrl ? `<a href="${escapeHtml(safePoolUrl)}" target="_blank" rel="noopener noreferrer sponsored" class="btn-ghost">View Pool</a>` : ''}
          <button class="btn-copy-address" data-address="${escapeHtml(p.token_address || p.pair_address)}" title="Copy Contract Address" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px;padding:2px 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
      </td>
    </tr>
  `;
}

function hasRequiredSocials(p) {
  if (!p) return false;
  const hasTwitter = Boolean(p.twitter_url && String(p.twitter_url).trim() !== '');
  const hasTelegram = Boolean(p.telegram_url && String(p.telegram_url).trim() !== '');
  return hasTwitter || hasTelegram;
}

function renderRadarRows(pairs, startIdx = 0) {
  const valid = (pairs || []).filter(hasRequiredSocials);
  if (valid.length === 0) {
    return `<tr><td colspan="9" class="state-msg">No newly discovered pairs in this classification.</td></tr>`;
  }
  return valid.map((p, idx) => renderSingleRadarRow(p, startIdx + idx, false)).join('');
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
        tbody.innerHTML = pairs.map((p, idx) => {
          const id = p.pair_address || p.token_address;
          const isFresh = id && !seenRadarPairIds.has(id);
          if (id) seenRadarPairIds.add(id);
          return renderSingleRadarRow(p, idx, isFresh);
        }).join('');

        setTimeout(() => {
          if (tbody) {
            tbody.querySelectorAll('.row-new-pair').forEach(el => el.classList.remove('row-new-pair'));
          }
        }, 3000);

        const feedbackEl = document.getElementById('radarLiveFeedback');
        if (feedbackEl) {
          feedbackEl.innerHTML = `<span style="color:#00e699;font-weight:700;">Updated with newly discovered pairs!</span>`;
          setTimeout(() => {
            if (feedbackEl) feedbackEl.textContent = 'Streaming On-Chain Feeds • Auto-Syncing';
          }, 3000);
        }
      } else {
        tbody.innerHTML = renderRadarRows(pairs, 0);
      }
    } else {
      pairs.forEach(p => {
        const id = p.pair_address || p.token_address;
        if (id) seenRadarPairIds.add(id);
      });
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
              nextPairs.forEach(p => {
                const id = p.pair_address || p.token_address;
                if (id) seenRadarPairIds.add(id);
              });
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
  if (!hasRequiredSocials(p)) return;
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
  seenRadarPairIds.add(pairId);
  const rowHtml = renderSingleRadarRow(p, 0, true);
  tbody.insertAdjacentHTML('afterbegin', rowHtml);

  // Auto-remove green glow animation after 3 seconds
  setTimeout(() => {
    const newRow = tbody.querySelector(`tr[data-pair-id="${pairId}"]`);
    if (newRow) newRow.classList.remove('row-new-pair');
  }, 3000);

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
    feedbackEl.innerHTML = `<span style="color:#00e699;font-weight:700;">Live catch: ${escapeHtml(p.symbol || p.name)} on ${srcCfg.name}!</span>`;
    setTimeout(() => {
      if (feedbackEl) feedbackEl.textContent = 'Streaming On-Chain Feeds • Auto-Syncing';
    }, 3500);
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
      </ul>

      <h2>3. Managing Your Storage</h2>
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
  document.querySelectorAll('.nav-item, .nav-dropdown-link, .mobile-nav-link').forEach(el => el.classList.remove('is-active'));
  const clean = (route === '/' || route === '') ? 'home' : route.replace('/', '');
  const elements = document.querySelectorAll(`[data-route="${clean}"]`);
  elements.forEach(el => {
    el.classList.add('is-active');
    const dropdown = el.closest('.nav-dropdown');
    if (dropdown) {
      dropdown.querySelector('.nav-dropdown-trigger')?.classList.add('is-active');
    }
  });
}

function toggleMobileMenu(forceState) {
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  const btn = document.getElementById('mobileMenuBtn');
  if (!drawer || !overlay) return;

  const isOpen = forceState !== undefined ? forceState : !drawer.classList.contains('is-open');
  if (isOpen) {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    if (btn) btn.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    if (btn) btn.classList.remove('is-active');
    document.body.style.overflow = '';
  }
}

function route() {
  toggleMobileMenu(false);
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
  } else if (path === '/gainers') {
    renderGainers();
  } else if (path === '/promoted') {
    renderPromotedPage();
  } else if (path === '/promote') {
    renderPromotePage(params.get('type'), params.get('slot'));
  } else if (path === '/admin') {
    renderAdminPage();
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

/* ---------------- real-time price & websocket streaming ---------------- */

let wsClient = null;
let wsReconnectTimer = null;
const lastKnownPrices = {};

const BINANCE_STREAM_MAP = {
  'BTCUSDT': 'BTC',
  'ETHUSDT': 'ETH',
  'BNBUSDT': 'BNB',
  'SOLUSDT': 'SOL',
  'XRPUSDT': 'XRP',
  'DOGEUSDT': 'DOGE',
  'ADAUSDT': 'ADA',
  'TRXUSDT': 'TRX',
  'LINKUSDT': 'LINK',
  'AVAXUSDT': 'AVAX',
  'SUIUSDT': 'SUI',
  'NEARUSDT': 'NEAR',
  'PEPEUSDT': 'PEPE',
  'SHIBUSDT': 'SHIB',
  'LTCUSDT': 'LTC',
  'WIFUSDT': 'WIF',
  'BONKUSDT': 'BONK'
};

function initDirectBinanceStream() {
  try {
    if (wsClient) {
      try { wsClient.close(); } catch (_) {}
    }
    const binanceUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
    wsClient = new WebSocket(binanceUrl);

    wsClient.onopen = () => {
      console.log('[WebSocket] Connected directly to Live Exchange Price Stream');
      const statusElem = document.getElementById('marketStatus');
      if (statusElem) {
        statusElem.className = 'market-status-indicator';
        statusElem.innerHTML = '<span class="live-pulse"></span> Market Live Stream';
      }
    };

    wsClient.onmessage = (event) => {
      try {
        const tickers = JSON.parse(event.data);
        if (!Array.isArray(tickers)) return;
        for (const item of tickers) {
          const sym = BINANCE_STREAM_MAP[item.s];
          if (sym) {
            const currentPrice = parseFloat(item.c);
            const openPrice = parseFloat(item.o);
            const change24h = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : null;
            const prevPrice = lastKnownPrices[sym] || currentPrice;
            lastKnownPrices[sym] = currentPrice;
            handleLivePriceUpdate({
              symbol: sym,
              price: currentPrice,
              change24h: change24h,
              direction: currentPrice >= prevPrice ? 'up' : 'down'
            });
          }
        }
      } catch (_) {}
    };

    wsClient.onclose = () => {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(initDirectBinanceStream, 4000);
    };

    wsClient.onerror = () => {
      try { wsClient.close(); } catch (_) {}
    };
  } catch (e) {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(initDirectBinanceStream, 5000);
  }
}

function initWebSocket() {
  const isVercel = location.hostname.includes('vercel.app');
  if (isVercel) {
    // Vercel serverless environment does not support persistent WebSockets, connect directly to public exchange stream
    return initDirectBinanceStream();
  }

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
      if (statusElem) {
        statusElem.className = 'market-status-indicator delayed';
        statusElem.textContent = '● Connecting Stream…';
      }
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      // Fallback to direct Binance stream if backend ws unavailable
      wsReconnectTimer = setTimeout(() => {
        initDirectBinanceStream();
      }, 3000);
    };

    wsClient.onerror = () => {
      wsClient.close();
    };
  } catch (err) {
    initDirectBinanceStream();
  }
}

function handleLivePriceUpdate(data) {
  const { symbol, price, change24h, direction } = data;
  if (!symbol) return;
  const safeSym = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(symbol) : symbol.replace(/["\\]/g, '\\$&');

  // 1. Update Table Rows with visual flash
  const rows = document.querySelectorAll(`tr[data-token-symbol="${safeSym}"]`);
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
  const tickers = document.querySelectorAll(`.tape-item[data-ticker-symbol="${safeSym}"]`);
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

