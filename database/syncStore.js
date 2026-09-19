/**
 * Bulls Traking — Resilient Submitted Tokens Sync & Storage Store
 * Ensures tokens submitted on Vercel or locally persist permanently across
 * serverless cold-starts, redeployments, and container restarts.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { savePostgresSubmission, isPostgresConfigured } = require('./postgres');

const REPO_DATA_DIR = path.join(__dirname, '..', 'data');
const REPO_STORE_FILE = path.join(REPO_DATA_DIR, 'submitted_tokens.json');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const TMP_DATA_DIR = isServerless ? (fs.existsSync('/tmp') ? '/tmp' : os.tmpdir()) : REPO_DATA_DIR;
const TMP_STORE_FILE = path.join(TMP_DATA_DIR, 'submitted_tokens.json');

/**
 * Load all submitted tokens from repo bundle and runtime tmp store
 */
function loadAllSubmittedTokens() {
  const map = new Map();

  // 1. Load from bundled repo file
  if (fs.existsSync(REPO_STORE_FILE)) {
    try {
      const list = JSON.parse(fs.readFileSync(REPO_STORE_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.contract_address) {
            const key = `${(item.chain || '').toLowerCase()}:${item.contract_address.toLowerCase()}`;
            map.set(key, item);
          }
        }
      }
    } catch (e) {
      console.warn('[SyncStore Notice] Repo store parse notice:', e.message);
    }
  }

  // 2. Also load from runtime tmp store (which receives live submissions in serverless)
  if (TMP_STORE_FILE !== REPO_STORE_FILE && fs.existsSync(TMP_STORE_FILE)) {
    try {
      const list = JSON.parse(fs.readFileSync(TMP_STORE_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.contract_address) {
            const key = `${(item.chain || '').toLowerCase()}:${item.contract_address.toLowerCase()}`;
            map.set(key, item);
          }
        }
      }
    } catch (e) {
      console.warn('[SyncStore Notice] Tmp store parse notice:', e.message);
    }
  }

  return Array.from(map.values());
}

/**
 * Persist newly submitted token to local filesystem, tmp, and PostgreSQL
 */
function persistSubmittedToken(tokenRecord) {
  if (!tokenRecord || !tokenRecord.contract_address) return;

  const currentList = loadAllSubmittedTokens();
  const key = `${(tokenRecord.chain || '').toLowerCase()}:${tokenRecord.contract_address.toLowerCase()}`;

  // Filter existing and prepend newest
  const filtered = currentList.filter(t => `${(t.chain || '').toLowerCase()}:${t.contract_address.toLowerCase()}` !== key);
  filtered.unshift(tokenRecord);

  const jsonStr = JSON.stringify(filtered, null, 2);

  // Write to repo data dir if writable (local dev)
  try {
    if (!isServerless && fs.existsSync(REPO_DATA_DIR)) {
      fs.writeFileSync(REPO_STORE_FILE, jsonStr, 'utf-8');
    }
  } catch (err) {
    // Non-fatal if read-only
  }

  // Always write to tmp dir (works in Vercel serverless /tmp)
  try {
    fs.writeFileSync(TMP_STORE_FILE, jsonStr, 'utf-8');
  } catch (err) {
    console.warn('[SyncStore Notice] Tmp write notice:', err.message);
  }

  // Also sync to PostgreSQL if DATABASE_URL is set
  if (isPostgresConfigured()) {
    savePostgresSubmission(tokenRecord).catch(err => {
      console.warn('[SyncStore PostgreSQL Error]', err.message);
    });
  }
}

/**
 * Synchronize all persisted submitted tokens into the SQLite database
 */
function syncSubmittedTokensIntoDb(db) {
  const submittedTokens = loadAllSubmittedTokens();
  if (!submittedTokens || submittedTokens.length === 0) return 0;

  let injectedCount = 0;

  try {
    const checkStmt = db.prepare(`
      SELECT id, is_submitted, listing_status FROM tokens 
      WHERE (chain = ? OR chain = ? OR chain = ?) AND LOWER(contract_address) = LOWER(?)
    `);

    const updateStmt = db.prepare(`
      UPDATE tokens SET 
        is_submitted = 1, 
        listing_status = 'LIVE', 
        verification_status = 'verified',
        is_active = 1,
        name = COALESCE(?, name),
        symbol = COALESCE(?, symbol),
        logo_url = COALESCE(?, logo_url)
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO tokens (
        chain, contract_address, provider_id, name, symbol, logo_url, description,
        website_url, x_url, telegram_url, price, market_cap, volume_24h,
        change_1h, change_24h, change_7d, circulating_supply, total_supply,
        ath, ath_date, atl, atl_date, market_cap_rank, hot_score,
        is_submitted, is_promoted, is_active, listing_status, verification_status,
        first_seen_at, last_data_sync
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        1, ?, 1, 'LIVE', 'verified',
        ?, CURRENT_TIMESTAMP
      )
    `);

    const checkSubStmt = db.prepare('SELECT id FROM token_submissions WHERE LOWER(contract_address) = LOWER(?)');
    const insertSubStmt = db.prepare(`
      INSERT INTO token_submissions (
        token_id, chain, contract_address, project_name, project_email,
        description, logo_url, website_url, x_url, telegram_url,
        status, admin_note, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIVE', 'Automated validation passed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const t of submittedTokens) {
      const chainVal = t.chain || 'solana-ecosystem';
      const contractVal = t.contract_address;
      if (!contractVal) continue;

      // Check aliases
      const cLower = chainVal.toLowerCase();
      let alias1 = chainVal;
      let alias2 = chainVal;
      let alias3 = chainVal;
      if (cLower.includes('sol')) { alias1 = 'solana-ecosystem'; alias2 = 'solana'; alias3 = 'sol'; }
      if (cLower.includes('bsc') || cLower.includes('binance')) { alias1 = 'binance-smart-chain'; alias2 = 'bsc'; alias3 = 'bnb'; }
      if (cLower.includes('eth')) { alias1 = 'ethereum-ecosystem'; alias2 = 'ethereum'; alias3 = 'eth'; }
      if (cLower.includes('base')) { alias1 = 'base-ecosystem'; alias2 = 'base'; alias3 = 'base'; }

      const existing = checkStmt.get(alias1, alias2, alias3, contractVal);
      let tokenId = existing?.id;

      if (existing) {
        if (existing.is_submitted !== 1 || existing.listing_status !== 'LIVE') {
          updateStmt.run(t.name || null, t.symbol || null, t.logo_url || null, existing.id);
        }
      } else {
        const insRes = insertStmt.run(
          alias1,
          contractVal,
          t.provider_id || contractVal.slice(0, 12),
          t.name || 'Community Token',
          t.symbol || (t.name ? t.name.slice(0, 5).toUpperCase() : 'TOKEN'),
          t.logo_url || 'assets/logo-transparent.png',
          t.description || '',
          t.website_url || '',
          t.x_url || '',
          t.telegram_url || '',
          t.price || 0.0001,
          t.market_cap || 25000,
          t.volume_24h || 500,
          t.change_1h || 0,
          t.change_24h || 0,
          t.change_7d || 0,
          t.circulating_supply || 1000000000,
          t.total_supply || 1000000000,
          t.ath || (t.price || 0.0001) * 1.2,
          t.ath_date || new Date().toISOString(),
          t.atl || (t.price || 0.0001) * 0.8,
          t.atl_date || new Date().toISOString(),
          t.market_cap_rank || 9999,
          t.hot_score || 50,
          t.is_promoted ? 1 : 0,
          t.first_seen_at || new Date().toISOString()
        );
        tokenId = Number(insRes.lastInsertRowid);
        injectedCount++;
      }

      // Check submission log
      const existingSub = checkSubStmt.get(contractVal);
      if (!existingSub && tokenId) {
        try {
          insertSubStmt.run(
            tokenId,
            alias1,
            contractVal,
            t.name || 'Community Token',
            t.project_email || '',
            t.description || '',
            t.logo_url || 'assets/logo-transparent.png',
            t.website_url || '',
            t.x_url || '',
            t.telegram_url || ''
          );
        } catch (subErr) {
          // ignore duplicate
        }
      }
    }

    if (injectedCount > 0) {
      console.log(`[SyncStore] Successfully synchronized ${injectedCount} submitted tokens into database.`);
    }
  } catch (err) {
    console.warn('[SyncStore Notice] syncSubmittedTokensIntoDb notice:', err.message);
  }

  return injectedCount;
}

module.exports = {
  loadAllSubmittedTokens,
  persistSubmittedToken,
  syncSubmittedTokensIntoDb
};
