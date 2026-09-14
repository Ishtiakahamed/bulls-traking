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
      return `<span class="tape-item"><b>${escapeHtml(c.symbol)}</b>${fmtPrice(c.price)}<span class="${cls}">${sign}${(chg ?? 0).toFixed(1)}%</span></span>`;
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
    elem.textContent = '● Market Data Live';
  }
}

/* ---------------- render table rows helper ---------------- */

function renderTokenRows(tokens, { showAge = false, showHot = false } = {}) {
  if (!tokens || tokens.length === 0) {
    return `<tr><td colspan="10" class="state-msg">No tokens found matching this view.</td></tr>`;
  }

  return tokens.map((t, idx) => {
    const isPositive = (t.change_24h ?? 0) >= 0;
    const spark = sparklineSvg(t.sparkline, isPositive);
    const isSubmitted = t.is_submitted === 1;

    return `
      <tr onclick="location.hash='#/token/${t.id}'">
        <td>${t.market_cap_rank || idx + 1}</td>
        <td>
          <div class="token-cell">
            <img src="${escapeHtml(t.logo_url || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png')}" alt="${escapeHtml(t.symbol)}" onerror="this.src='https://assets.coingecko.com/coins/images/325/standard/Tether.png'">
            <div>
              <span class="token-name">${escapeHtml(t.name)}</span>
              <span class="token-sym">${escapeHtml(t.symbol)}</span>
              ${isSubmitted ? '<span class="badge-new">NEW</span>' : ''}
              ${showAge && t.age ? `<span class="badge-age">${escapeHtml(t.age)}</span>` : ''}
              ${showHot ? `<span class="badge-hot">🔥 ${t.hot_score}</span>` : ''}
            </div>
          </div>
        </td>
        <td><b>${fmtPrice(t.price)}</b></td>
        <td>${fmtChg(t.change_1h)}</td>
        <td>${fmtChg(t.change_24h)}</td>
        <td>${fmtChg(t.change_7d)}</td>
        <td>${fmtUsd(t.volume_24h)}</td>
        <td>${fmtUsd(t.market_cap)}</td>
        <td>${spark}</td>
      </tr>
    `;
  }).join('');
}

/* ---------------- 1. HOME VIEW ---------------- */

async function renderHome() {
  app.innerHTML = `<div class="state-msg">Loading Bulls Traking market data…</div>`;

  try {
    const res = await fetchApi(`/home?chain=${state.chain}`);
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

    let currentTabTokens = data.trending;
    if (state.tab === 'new') currentTabTokens = data.new;
    if (state.tab === 'hot') currentTabTokens = data.hot;
    if (state.tab === 'gainers') currentTabTokens = data.gainers;

    app.innerHTML = `
      <!-- MARKET STATS -->
      <div class="hero-overview">
        <div class="hero-stat-card">
          <div class="label">Total Market Cap</div>
          <div class="val">${fmtUsd(data.marketStats?.totalMarketCap)}</div>
        </div>
        <div class="hero-stat-card">
          <div class="label">24h Trading Volume</div>
          <div class="val">${fmtUsd(data.marketStats?.total24hVolume)}</div>
        </div>
        <div class="hero-stat-card">
          <div class="label">Tracked Assets</div>
          <div class="val">${data.marketStats?.totalTokens || 0}</div>
        </div>
      </div>

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
          <span class="subtab ${state.tab === 'trending' ? 'is-active' : ''}" data-tab="trending">🔥 Trending</span>
          <span class="subtab ${state.tab === 'new' ? 'is-active' : ''}" data-tab="new">🆕 New Coins</span>
          <span class="subtab ${state.tab === 'hot' ? 'is-active' : ''}" data-tab="hot">⚡ Hot Coins</span>
          <span class="subtab ${state.tab === 'gainers' ? 'is-active' : ''}" data-tab="gainers">📈 Top Gainers</span>
        </div>

        <div class="chains" id="homeChains">
          ${Object.keys(CHAINS).map(k => `
            <button class="chain-pill ${state.chain === k ? 'is-active' : ''}" data-chain="${k}">
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
              <th>#</th>
              <th>Token</th>
              <th>Price</th>
              <th>1h</th>
              <th>24h</th>
              <th>7d</th>
              <th>24h Volume</th>
              <th>Market Cap</th>
              <th>Last 7 Days</th>
            </tr>
          </thead>
          <tbody id="homeTableBody">
            ${renderTokenRows(currentTabTokens, { showAge: state.tab === 'new', showHot: state.tab === 'hot' })}
          </tbody>
        </table>
      </div>
    `;

    // Bind Home tabs
    document.getElementById('homeTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.subtab');
      if (!tab) return;
      state.tab = tab.dataset.tab;
      document.querySelectorAll('#homeTabs .subtab').forEach(el => el.classList.remove('is-active'));
      tab.classList.add('is-active');

      let tokens = data.trending;
      if (state.tab === 'new') tokens = data.new;
      if (state.tab === 'hot') tokens = data.hot;
      if (state.tab === 'gainers') tokens = data.gainers;

      document.getElementById('homeTableBody').innerHTML = renderTokenRows(tokens, {
        showAge: state.tab === 'new',
        showHot: state.tab === 'hot'
      });
    });

    // Bind Home chains
    document.getElementById('homeChains').addEventListener('click', (e) => {
      const pill = e.target.closest('.chain-pill');
      if (!pill) return;
      state.chain = pill.dataset.chain;
      renderHome();
    });

  } catch (err) {
    app.innerHTML = `<div class="state-msg">Unable to load market data: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- 2. TOP COINS VIEW (/top-coins) ---------------- */

async function renderTopCoins() {
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
            <th>Rank</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>24h Volume</th><th>Market Cap</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="topTableBody">
          <tr><td colspan="9" class="state-msg">Loading Top Coins…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('topChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    renderTopCoins();
  });

  try {
    const res = await fetchApi(`/tokens/top?chain=${state.chain}&limit=50`);
    document.getElementById('topTableBody').innerHTML = renderTokenRows(res.tokens);
  } catch (err) {
    document.getElementById('topTableBody').innerHTML = `<tr><td colspan="9" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 3. NEW COINS VIEW (/new-coins) ---------------- */

async function renderNewCoins() {
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
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>24h Volume</th><th>Market Cap</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="newTableBody">
          <tr><td colspan="9" class="state-msg">Loading New Coins…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('newChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    renderNewCoins();
  });

  try {
    const res = await fetchApi(`/tokens/new?chain=${state.chain}&limit=50`);
    document.getElementById('newTableBody').innerHTML = renderTokenRows(res.tokens, { showAge: true });
  } catch (err) {
    document.getElementById('newTableBody').innerHTML = `<tr><td colspan="9" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 4. HOT COINS VIEW (/hot) ---------------- */

async function renderHotCoins() {
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
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>24h Volume</th><th>Market Cap</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="hotTableBody">
          <tr><td colspan="9" class="state-msg">Loading Hot Coins…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('hotChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    renderHotCoins();
  });

  try {
    const res = await fetchApi(`/tokens/hot?chain=${state.chain}&limit=50`);
    document.getElementById('hotTableBody').innerHTML = renderTokenRows(res.tokens, { showHot: true });
  } catch (err) {
    document.getElementById('hotTableBody').innerHTML = `<tr><td colspan="9" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------------- 5. GAINERS VIEW (/gainers) ---------------- */

async function renderGainers() {
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
            <th>#</th><th>Token</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th>
            <th>24h Volume</th><th>Market Cap</th><th>Last 7 Days</th>
          </tr>
        </thead>
        <tbody id="gainersTableBody">
          <tr><td colspan="9" class="state-msg">Loading Top Gainers…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('gainersChains').addEventListener('click', (e) => {
    const pill = e.target.closest('.chain-pill');
    if (!pill) return;
    state.chain = pill.dataset.chain;
    renderGainers();
  });

  try {
    const res = await fetchApi(`/tokens/gainers?chain=${state.chain}&limit=50`);
    document.getElementById('gainersTableBody').innerHTML = renderTokenRows(res.tokens);
  } catch (err) {
    document.getElementById('gainersTableBody').innerHTML = `<tr><td colspan="9" class="state-msg">Error: ${escapeHtml(err.message)}</td></tr>`;
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
  } catch (err) {
    document.getElementById('promotedGrid').innerHTML = `<div class="state-msg">Error: ${escapeHtml(err.message)}</div>`;
  }
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
          <h1>${escapeHtml(t.name)} <span class="sym">$${escapeHtml(t.symbol)}</span></h1>
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
  } else if (path === '/new-coins') {
    renderNewCoins();
  } else if (path === '/hot') {
    renderHotCoins();
  } else if (path === '/gainers') {
    renderGainers();
  } else if (path === '/promoted') {
    renderPromotedPage();
  } else if (path === '/presales') {
    renderPresales();
  } else if (path === '/submit') {
    renderSubmit();
  } else if (path.startsWith('/token/')) {
    const id = path.replace('/token/', '');
    renderTokenDetail(id);
  } else {
    renderHome();
  }
}

/* ---------------- boot ---------------- */

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  loadTape();
  initSearch();
  route();
});
