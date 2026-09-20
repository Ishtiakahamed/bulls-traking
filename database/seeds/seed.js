module.exports = { runSeed };

function runSeed(skipInit = false) {
  const { initDatabase, execute, queryOne, query, transaction, db } = require('../db');
  if (!skipInit) {
    console.log('[Seed] Initializing Phase 1 database schema...');
    initDatabase();
  }

  console.log('[Seed] Seeding Bulls Traking tokens & promotions...');

  transaction(() => {
    // Clear existing for clean seed
    execute(`DELETE FROM promotions`);
    execute(`DELETE FROM token_price_history`);
    execute(`DELETE FROM token_submissions`);
    execute(`DELETE FROM tokens`);

    const tokens = [
      {
        chain: 'bitcoin',
        contract_address: '0x0000000000000000000000000000000000000001',
        provider_id: '1',
        coingecko_id: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'BTC',
        logo_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        description: 'The first and largest decentralized digital cryptocurrency, created by Satoshi Nakamoto.',
        website_url: 'https://bitcoin.org',
        x_url: 'https://x.com/bitcoin',
        telegram_url: null,
        price: 80450.00,
        market_cap: 1613000000000,
        volume_24h: 24500000000,
        change_1h: 0.15,
        change_24h: 2.45,
        change_7d: 5.80,
        circulating_supply: 19800000,
        total_supply: 21000000,
        ath: 108900.00,
        ath_date: '2025-01-20T00:00:00.000Z',
        atl: 67.81,
        atl_date: '2013-07-06T00:00:00.000Z',
        market_cap_rank: 1,
        hot_score: 99.0,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'official',
        first_seen_at: new Date(Date.now() - 365 * 86400000).toISOString()
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'So11111111111111111111111111111111111111112',
        provider_id: 'solana',
        name: 'Solana',
        symbol: 'SOL',
        logo_url: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
        description: 'High-speed decentralized blockchain built for high-throughput Web3 applications.',
        website_url: 'https://solana.com',
        x_url: 'https://x.com/solana',
        telegram_url: 'https://t.me/solana',
        price: 186.40,
        market_cap: 86400000000,
        volume_24h: 3950000000,
        change_1h: 0.35,
        change_24h: 5.92,
        change_7d: 14.80,
        circulating_supply: 463000000,
        total_supply: 585000000,
        ath: 259.96,
        ath_date: '2021-11-06T21:54:35.825Z',
        atl: 0.5008,
        atl_date: '2020-05-11T19:35:23.449Z',
        market_cap_rank: 1,
        hot_score: 94.5,
        is_submitted: 0,
        is_promoted: 1,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'official',
        first_seen_at: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        chain: 'ethereum-ecosystem',
        contract_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        provider_id: 'ethereum',
        name: 'Ethereum',
        symbol: 'ETH',
        logo_url: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
        description: 'Decentralized platform that runs smart contracts and global decentralized finance.',
        website_url: 'https://ethereum.org',
        x_url: 'https://x.com/ethereum',
        telegram_url: 'https://t.me/ethereum',
        price: 3435.20,
        market_cap: 412000000000,
        volume_24h: 18200000000,
        change_1h: -0.15,
        change_24h: 3.10,
        change_7d: 8.60,
        circulating_supply: 120000000,
        total_supply: 120000000,
        ath: 4878.26,
        ath_date: '2021-11-10T14:24:19.604Z',
        atl: 0.4329,
        atl_date: '2015-10-20T00:00:00.000Z',
        market_cap_rank: 2,
        hot_score: 96.2,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'official',
        first_seen_at: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        chain: 'binance-smart-chain',
        contract_address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        provider_id: 'binancecoin',
        name: 'BNB',
        symbol: 'BNB',
        logo_url: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
        description: 'Native gas token powering the BNB Chain ecosystem and Binance DEX.',
        website_url: 'https://bnbchain.org',
        x_url: 'https://x.com/BNBCHAIN',
        telegram_url: 'https://t.me/BNBchainduck',
        price: 592.50,
        market_cap: 85900000000,
        volume_24h: 1280000000,
        change_1h: 0.22,
        change_24h: 2.45,
        change_7d: 5.10,
        circulating_supply: 145000000,
        total_supply: 145000000,
        ath: 717.48,
        ath_date: '2024-06-06T15:30:00.000Z',
        atl: 0.0398,
        atl_date: '2017-10-19T00:00:00.000Z',
        market_cap_rank: 3,
        hot_score: 88.0,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'official',
        first_seen_at: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        chain: 'base-ecosystem',
        contract_address: '0x4200000000000000000000000000000000000006',
        provider_id: 'weth',
        name: 'Base Wrapped ETH',
        symbol: 'WETH',
        logo_url: 'https://assets.coingecko.com/coins/images/2518/standard/weth.png',
        description: 'Wrapped Ethereum on Coinbase Base Layer-2 network.',
        website_url: 'https://base.org',
        x_url: 'https://x.com/base',
        telegram_url: 'https://t.me/basechain',
        price: 3436.00,
        market_cap: 3260000000,
        volume_24h: 460000000,
        change_1h: -0.10,
        change_24h: 3.12,
        change_7d: 8.80,
        circulating_supply: 950000,
        total_supply: 950000,
        ath: 4850.00,
        ath_date: '2021-11-10T14:24:19.604Z',
        atl: 1200.00,
        atl_date: '2023-08-01T00:00:00.000Z',
        market_cap_rank: 4,
        hot_score: 82.5,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'official',
        first_seen_at: new Date(Date.now() - 25 * 86400000).toISOString()
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        provider_id: 'dogwifcoin',
        name: 'dogwifhat',
        symbol: 'WIF',
        logo_url: 'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
        description: 'Iconic meme token sensation on Solana.',
        website_url: 'https://dogwifcoin.org',
        x_url: 'https://x.com/dogwifcoin',
        telegram_url: 'https://t.me/dogwifcoin',
        price: 2.48,
        market_cap: 2470000000,
        volume_24h: 390000000,
        change_1h: 1.15,
        change_24h: 14.60,
        change_7d: 41.20,
        circulating_supply: 998900000,
        total_supply: 998900000,
        ath: 4.83,
        ath_date: '2024-03-31T00:00:00.000Z',
        atl: 0.00155,
        atl_date: '2023-12-13T00:00:00.000Z',
        market_cap_rank: 5,
        hot_score: 92.8,
        is_submitted: 0,
        is_promoted: 1,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'verified',
        first_seen_at: new Date(Date.now() - 15 * 86400000).toISOString()
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        provider_id: 'bonk',
        name: 'Bonk',
        symbol: 'BONK',
        logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
        description: 'First dog community token on Solana for the decentralized social movement.',
        website_url: 'https://bonkcoin.com',
        x_url: 'https://x.com/bonk_inu',
        telegram_url: 'https://t.me/bonk_inu',
        price: 0.0000288,
        market_cap: 2150000000,
        volume_24h: 310000000,
        change_1h: -0.30,
        change_24h: 9.15,
        change_7d: 24.50,
        circulating_supply: 75000000000000,
        total_supply: 93000000000000,
        ath: 0.000045,
        ath_date: '2024-03-04T00:00:00.000Z',
        atl: 0.000000086,
        atl_date: '2022-12-30T00:00:00.000Z',
        market_cap_rank: 6,
        hot_score: 87.4,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'verified',
        first_seen_at: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        chain: 'base-ecosystem',
        contract_address: '0x532f27101965dd16442e59d40670faf5ebb142e4',
        provider_id: 'brett',
        name: 'Brett',
        symbol: 'BRETT',
        logo_url: 'https://assets.coingecko.com/coins/images/35529/standard/brett.png',
        description: 'Top viral community meme token on Coinbase Base network.',
        website_url: 'https://basedbrett.com',
        x_url: 'https://x.com/BasedBrett',
        telegram_url: 'https://t.me/basedbrett',
        price: 0.098,
        market_cap: 970000000,
        volume_24h: 72000000,
        change_1h: 0.90,
        change_24h: 16.80,
        change_7d: 44.50,
        circulating_supply: 9910000000,
        total_supply: 10000000000,
        ath: 0.193,
        ath_date: '2024-06-09T00:00:00.000Z',
        atl: 0.0028,
        atl_date: '2024-02-29T00:00:00.000Z',
        market_cap_rank: 7,
        hot_score: 89.2,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'verified',
        first_seen_at: new Date(Date.now() - 10 * 86400000).toISOString()
      },
      {
        chain: 'binance-smart-chain',
        contract_address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        provider_id: 'pancakeswap-token',
        name: 'PancakeSwap',
        symbol: 'CAKE',
        logo_url: 'https://assets.coingecko.com/coins/images/12632/standard/pancakeswap-cake-logo_2x.png',
        description: 'Leading decentralized automated market maker exchange token on BSC.',
        website_url: 'https://pancakeswap.finance',
        x_url: 'https://x.com/PancakeSwap',
        telegram_url: 'https://t.me/PancakeSwap',
        price: 2.22,
        market_cap: 625000000,
        volume_24h: 54000000,
        change_1h: 0.18,
        change_24h: 3.80,
        change_7d: 7.20,
        circulating_supply: 280000000,
        total_supply: 380000000,
        ath: 43.96,
        ath_date: '2021-04-30T00:00:00.000Z',
        atl: 0.194,
        atl_date: '2020-11-03T00:00:00.000Z',
        market_cap_rank: 8,
        hot_score: 80.1,
        is_submitted: 0,
        is_promoted: 0,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'verified',
        first_seen_at: new Date(Date.now() - 28 * 86400000).toISOString()
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'BullsTrakingOfficialAlphaToken111111111',
        provider_id: 'bulls-traking',
        name: 'Bulls Traking Alpha',
        symbol: 'BULL',
        logo_url: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
        description: 'Utility asset powering Bulls Traking premium features and priority listings.',
        website_url: 'https://bullstraking.io',
        x_url: 'https://x.com/BullsTraking',
        telegram_url: 'https://t.me/BullsTrakingOfficial',
        price: 0.00045,
        market_cap: 337500,
        volume_24h: 98000,
        change_1h: 3.80,
        change_24h: 36.50,
        change_7d: 115.00,
        circulating_supply: 750000000,
        total_supply: 1000000000,
        ath: 0.00085,
        ath_date: '2026-09-01T00:00:00.000Z',
        atl: 0.00005,
        atl_date: '2026-08-15T00:00:00.000Z',
        market_cap_rank: 9,
        hot_score: 95.0,
        is_submitted: 0,
        is_promoted: 1,
        is_active: 1,
        listing_status: 'LIVE',
        verification_status: 'verified',
        first_seen_at: new Date(Date.now() - 2 * 3600000).toISOString() // 2 hours ago
      }
    ];

    const insertTokenStmt = `INSERT INTO tokens (
      chain, contract_address, provider_id, name, symbol, logo_url, description,
      website_url, x_url, telegram_url, price, market_cap, volume_24h,
      change_1h, change_24h, change_7d, circulating_supply, total_supply,
      ath, ath_date, atl, atl_date, market_cap_rank, hot_score,
      is_submitted, is_promoted, is_active, listing_status, verification_status,
      first_seen_at, last_data_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    for (const t of tokens) {
      execute(insertTokenStmt, [
        t.chain, t.contract_address, t.provider_id, t.name, t.symbol, t.logo_url, t.description,
        t.website_url, t.x_url, t.telegram_url, t.price, t.market_cap, t.volume_24h,
        t.change_1h, t.change_24h, t.change_7d, t.circulating_supply, t.total_supply,
        t.ath, t.ath_date, t.atl, t.atl_date, t.market_cap_rank, t.hot_score,
        t.is_submitted, t.is_promoted, t.is_active, t.listing_status, t.verification_status,
        t.first_seen_at
      ]);
    }

    // Seed 7D price history
    const allTokens = query(`SELECT id, price, market_cap, volume_24h FROM tokens`);
    const nowSec = Math.floor(Date.now() / 1000);

    for (const tok of allTokens) {
      for (let i = 13; i >= 0; i--) {
        const factor = 0.88 + Math.random() * 0.24;
        execute(`INSERT INTO token_price_history (token_id, price, market_cap, volume_24h, timestamp)
          VALUES (?, ?, ?, ?, ?)`, [
          tok.id, tok.price * factor, (tok.market_cap || 100000) * factor, (tok.volume_24h || 10000) * factor,
          nowSec - (i * 43200) // 12h intervals
        ]);
      }
    }

    // Seed active promotions
    const bullToken = queryOne("SELECT id FROM tokens WHERE symbol = 'BULL'");
    const solToken = queryOne("SELECT id FROM tokens WHERE symbol = 'SOL'");
    const wifToken = queryOne("SELECT id FROM tokens WHERE symbol = 'WIF'");

    const insertPromo = `INSERT INTO promotions (token_id, promotion_type, package_name, start_at, end_at, priority, is_active)
      VALUES (?, ?, ?, datetime('now', '-1 day'), datetime('now', '+6 days'), ?, 1)`;

    if (bullToken) {
      execute(insertPromo, [bullToken.id, 'PROMOTED_TOKEN', 'Alpha Spotlight Tier', 10]);
    }
    // Load pre-discovered tokens pool if available (essential for serverless/Vercel fresh container boot)
    const fs = require('node:fs');
    const path = require('node:path');
    const discoveredPath = path.join(__dirname, 'discovered_tokens.json');
    if (fs.existsSync(discoveredPath)) {
      try {
        const discovered = JSON.parse(fs.readFileSync(discoveredPath, 'utf-8'));
        const insertDiscoveredStmt = `
          INSERT OR IGNORE INTO tokens (
            chain, contract_address, coingecko_id, provider_id, name, symbol, logo_url,
            price, market_cap, volume_24h, change_1h, change_24h, change_7d,
            circulating_supply, total_supply, ath, ath_date, atl, atl_date,
            market_cap_rank, hot_score, txn_count_24h, price_change_6h, liquidity,
            is_submitted, is_promoted, is_active, listing_status, verification_status,
            first_seen_at, last_data_sync
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            0, 0, 1, 'LIVE', 'verified',
            ?, CURRENT_TIMESTAMP
          )
        `;
        for (const dt of discovered) {
          const exists = queryOne('SELECT id FROM tokens WHERE chain = ? AND (coingecko_id = ? OR UPPER(TRIM(symbol)) = UPPER(TRIM(?))) LIMIT 1', [dt.chain, dt.coingecko_id, dt.symbol]);
          if (exists) continue;
          execute(insertDiscoveredStmt, [
            dt.chain, dt.contract_address, dt.coingecko_id, dt.provider_id, dt.name, dt.symbol, dt.logo_url,
            dt.price, dt.market_cap, dt.volume_24h, dt.change_1h, dt.change_24h, dt.change_7d,
            dt.circulating_supply, dt.total_supply, dt.ath, dt.ath_date, dt.atl, dt.atl_date,
            dt.market_cap_rank, dt.hot_score, dt.txn_count_24h || 0, dt.price_change_6h || 0, dt.liquidity || 0,
            dt.first_seen_at || new Date().toISOString()
          ]);
        }
        console.log(`[Seed] Successfully seeded ${discovered.length} pre-discovered tokens.`);
      } catch (err) {
        console.warn('[Seed Warning] Failed loading discovered_tokens.json:', err.message);
      }
    }
  });

  // Re-inject all user-submitted tokens after seeding so they are never lost
  try {
    const { syncSubmittedTokensIntoDb } = require('../syncStore');
    const { db } = require('../db');
    syncSubmittedTokensIntoDb(db);
  } catch (syncErr) {
    console.warn('[Seed Submitted Tokens Sync Notice]', syncErr.message);
  }

  console.log('[Seed] Bulls Traking Phase 1 database seeded successfully!');
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
