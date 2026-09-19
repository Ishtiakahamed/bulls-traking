/**
 * Bulls Traking — PostgreSQL Connector & Sync Layer
 * Connects to PostgreSQL when DATABASE_URL or POSTGRES_URL is provided
 * (Compatible with Supabase, Neon, Vercel Postgres, Railway, RDS, etc.)
 */

const fs = require('node:fs');
const path = require('node:path');

let pool = null;
let isInitialized = false;

function getPostgresUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

function isPostgresConfigured() {
  return Boolean(getPostgresUrl());
}

function getPool() {
  if (pool) return pool;
  const connectionString = getPostgresUrl();
  if (!connectionString) return null;

  try {
    const { Pool } = require('pg');
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]', err.message);
    });

    return pool;
  } catch (err) {
    console.warn('[PostgreSQL Init Notice] pg module not available or connection error:', err.message);
    return null;
  }
}

async function initPostgresSchema() {
  if (isInitialized) return;
  const p = getPool();
  if (!p) return;

  try {
    const schemaPath = path.join(__dirname, 'migrations', '001_phase1_schema.postgres.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await p.query(schemaSql);
      console.log('[PostgreSQL] Bulls Traking PostgreSQL schema verified.');
    }
    isInitialized = true;
  } catch (err) {
    console.warn('[PostgreSQL Schema Notice]', err.message);
  }
}

/**
 * Save a submitted token to PostgreSQL if configured
 */
async function savePostgresSubmission(tokenData) {
  const p = getPool();
  if (!p) return false;

  try {
    const insertSql = `
      INSERT INTO tokens (
        chain, contract_address, provider_id, name, symbol, logo_url, description,
        website_url, x_url, telegram_url, price, market_cap, volume_24h,
        change_1h, change_24h, change_7d, circulating_supply, total_supply,
        ath, ath_date, atl, atl_date, market_cap_rank, hot_score,
        is_submitted, is_promoted, is_active, listing_status, verification_status,
        first_seen_at, last_data_sync
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, CURRENT_TIMESTAMP, $20, CURRENT_TIMESTAMP, $21, $22,
        TRUE, FALSE, TRUE, 'LIVE', 'verified',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (chain, contract_address) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        logo_url = COALESCE(EXCLUDED.logo_url, tokens.logo_url),
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        volume_24h = EXCLUDED.volume_24h,
        is_submitted = TRUE,
        listing_status = 'LIVE',
        updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `;

    const values = [
      tokenData.chain,
      tokenData.contract_address,
      tokenData.provider_id || tokenData.contract_address.slice(0, 12),
      tokenData.name,
      tokenData.symbol,
      tokenData.logo_url || '',
      tokenData.description || '',
      tokenData.website_url || '',
      tokenData.x_url || '',
      tokenData.telegram_url || '',
      tokenData.price || 0.00001,
      tokenData.market_cap || 25000,
      tokenData.volume_24h || 500,
      tokenData.change_1h || 0,
      tokenData.change_24h || 0,
      tokenData.change_7d || 0,
      tokenData.circulating_supply || 1000000000,
      tokenData.total_supply || 1000000000,
      tokenData.ath || (tokenData.price || 0.00001) * 1.2,
      tokenData.atl || (tokenData.price || 0.00001) * 0.8,
      tokenData.market_cap_rank || 9999,
      tokenData.hot_score || 50
    ];

    const res = await p.query(insertSql, values);
    const pgTokenId = res.rows[0]?.id;

    // Also insert submission log
    await p.query(`
      INSERT INTO token_submissions (
        token_id, chain, contract_address, project_name, project_email,
        description, logo_url, website_url, x_url, telegram_url,
        status, admin_note, submitted_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'LIVE', 'Automated validation passed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      pgTokenId,
      tokenData.chain,
      tokenData.contract_address,
      tokenData.name,
      tokenData.project_email || '',
      tokenData.description || '',
      tokenData.logo_url || '',
      tokenData.website_url || '',
      tokenData.x_url || '',
      tokenData.telegram_url || ''
    ]);

    console.log(`[PostgreSQL] Token '${tokenData.name}' (${tokenData.symbol}) synced to PostgreSQL database. ID: ${pgTokenId}`);
    return true;
  } catch (err) {
    console.warn('[PostgreSQL Sync Warning]', err.message);
    return false;
  }
}

/**
 * Fetch all submitted tokens from PostgreSQL
 */
async function fetchPostgresSubmissions() {
  const p = getPool();
  if (!p) return [];

  try {
    const res = await p.query(`
      SELECT * FROM tokens 
      WHERE is_submitted = TRUE OR listing_status = 'LIVE'
      ORDER BY first_seen_at DESC
    `);
    return res.rows || [];
  } catch (err) {
    console.warn('[PostgreSQL Fetch Warning]', err.message);
    return [];
  }
}

module.exports = {
  isPostgresConfigured,
  initPostgresSchema,
  savePostgresSubmission,
  fetchPostgresSubmissions
};
