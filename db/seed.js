const { initDatabase, execute, queryOne, query, transaction } = require('./database');

function runSeed() {
  console.log('[Seed] Initializing database schema...');
  initDatabase();

  console.log('[Seed] Seeding Bull Straking initial database records...');

  transaction(() => {
    // 1. Banner Slots
    execute(`INSERT OR IGNORE INTO banner_slots (id, slot_name, position, is_active) VALUES 
      (1, 'Top Header Banner Slot', 'top_banner', 1),
      (2, 'Homepage Featured Banner', 'homepage_banner', 1),
      (3, 'Presale Spotlight Banner', 'presale_banner', 1);`);

    // 2. Initial Tokens
    const tokens = [
      {
        chain: 'solana-ecosystem',
        contract_address: 'So11111111111111111111111111111111111111112',
        name: 'Solana',
        symbol: 'SOL',
        logo_url: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
        description: 'High-performance blockchain supporting builders across the globe.',
        website_url: 'https://solana.com',
        x_url: 'https://x.com/solana',
        telegram_url: 'https://t.me/solana',
        decimals: 9,
        total_supply: 580000000,
        circulating_supply: 460000000,
        price: 184.50,
        market_cap: 85200000000,
        volume_24h: 3800000000,
        liquidity: 950000000,
        price_change_1h: 0.45,
        price_change_24h: 5.82,
        price_change_7d: 14.20,
        ath: 259.96,
        atl: 0.50,
        rank: 1,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'official'
      },
      {
        chain: 'ethereum-ecosystem',
        contract_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        name: 'Ethereum',
        symbol: 'ETH',
        logo_url: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
        description: 'Decentralized open-source blockchain with smart contract functionality.',
        website_url: 'https://ethereum.org',
        x_url: 'https://x.com/ethereum',
        telegram_url: 'https://t.me/ethereum',
        decimals: 18,
        total_supply: 120000000,
        circulating_supply: 120000000,
        price: 3420.75,
        market_cap: 410000000000,
        volume_24h: 18500000000,
        liquidity: 4200000000,
        price_change_1h: -0.12,
        price_change_24h: 3.40,
        price_change_7d: 8.90,
        ath: 4878.26,
        atl: 0.43,
        rank: 2,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'official'
      },
      {
        chain: 'binance-smart-chain',
        contract_address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        name: 'BNB',
        symbol: 'BNB',
        logo_url: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
        description: 'Gas token and engine behind BNB Chain ecosystem.',
        website_url: 'https://bnbchain.org',
        x_url: 'https://x.com/BNBCHAIN',
        telegram_url: 'https://t.me/BNBchainduck',
        decimals: 18,
        total_supply: 145000000,
        circulating_supply: 145000000,
        price: 590.20,
        market_cap: 85500000000,
        volume_24h: 1200000000,
        liquidity: 680000000,
        price_change_1h: 0.20,
        price_change_24h: 2.15,
        price_change_7d: 4.80,
        ath: 717.48,
        atl: 0.039,
        rank: 3,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'official'
      },
      {
        chain: 'base-ecosystem',
        contract_address: '0x4200000000000000000000000000000000000006',
        name: 'Base Wrapped ETH',
        symbol: 'WETH',
        logo_url: 'https://assets.coingecko.com/coins/images/2518/standard/weth.png',
        description: 'Wrapped Ethereum on Base L2 network.',
        website_url: 'https://base.org',
        x_url: 'https://x.com/base',
        telegram_url: 'https://t.me/basechain',
        decimals: 18,
        total_supply: 950000,
        circulating_supply: 950000,
        price: 3421.10,
        market_cap: 3250000000,
        volume_24h: 450000000,
        liquidity: 140000000,
        price_change_1h: -0.05,
        price_change_24h: 3.42,
        price_change_7d: 9.10,
        ath: 4850.00,
        atl: 1200.00,
        rank: 4,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'official'
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        name: 'dogwifhat',
        symbol: 'WIF',
        logo_url: 'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
        description: 'Literally just a dog wif a hat on Solana.',
        website_url: 'https://dogwifcoin.org',
        x_url: 'https://x.com/dogwifcoin',
        telegram_url: 'https://t.me/dogwifcoin',
        decimals: 6,
        total_supply: 998900000,
        circulating_supply: 998900000,
        price: 2.45,
        market_cap: 2450000000,
        volume_24h: 380000000,
        liquidity: 75000000,
        price_change_1h: 1.20,
        price_change_24h: 12.80,
        price_change_7d: 38.50,
        ath: 4.83,
        atl: 0.0015,
        rank: 5,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'verified'
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonk',
        symbol: 'BONK',
        logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
        description: 'The first dog coin on Solana for the people, by the people.',
        website_url: 'https://bonkcoin.com',
        x_url: 'https://x.com/bonk_inu',
        telegram_url: 'https://t.me/bonk_inu',
        decimals: 5,
        total_supply: 93000000000000,
        circulating_supply: 75000000000000,
        price: 0.0000285,
        market_cap: 2130000000,
        volume_24h: 290000000,
        liquidity: 62000000,
        price_change_1h: -0.40,
        price_change_24h: 8.40,
        price_change_7d: 22.10,
        ath: 0.000045,
        atl: 0.000000086,
        rank: 6,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'verified'
      },
      {
        chain: 'base-ecosystem',
        contract_address: '0x532f27101965dd16442e59d40670faf5ebb142e4',
        name: 'Brett',
        symbol: 'BRETT',
        logo_url: 'https://assets.coingecko.com/coins/images/35529/standard/brett.png',
        description: 'The legendary meme mascot and top community token of Base.',
        website_url: 'https://basedbrett.com',
        x_url: 'https://x.com/BasedBrett',
        telegram_url: 'https://t.me/basedbrett',
        decimals: 18,
        total_supply: 10000000000,
        circulating_supply: 9910000000,
        price: 0.095,
        market_cap: 940000000,
        volume_24h: 68000000,
        liquidity: 24000000,
        price_change_1h: 0.85,
        price_change_24h: 15.20,
        price_change_7d: 42.10,
        ath: 0.193,
        atl: 0.0028,
        rank: 7,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'verified'
      },
      {
        chain: 'binance-smart-chain',
        contract_address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        name: 'PancakeSwap Token',
        symbol: 'CAKE',
        logo_url: 'https://assets.coingecko.com/coins/images/12632/standard/pancakeswap-cake-logo_2x.png',
        description: 'The leading DEX automated market maker on BNB Smart Chain.',
        website_url: 'https://pancakeswap.finance',
        x_url: 'https://x.com/PancakeSwap',
        telegram_url: 'https://t.me/PancakeSwap',
        decimals: 18,
        total_supply: 380000000,
        circulating_supply: 280000000,
        price: 2.18,
        market_cap: 610000000,
        volume_24h: 52000000,
        liquidity: 180000000,
        price_change_1h: 0.15,
        price_change_24h: -1.25,
        price_change_7d: 6.40,
        ath: 43.96,
        atl: 0.19,
        rank: 8,
        status: 'active',
        listing_status: 'LIVE',
        verification_status: 'verified'
      },
      {
        chain: 'solana-ecosystem',
        contract_address: 'BullTracK1111111111111111111111111111111111',
        name: 'Bull Straking Alpha',
        symbol: 'BULL',
        logo_url: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
        description: 'Official community utility token for Bull Straking analytics & ad discounts.',
        website_url: 'https://bullstraking.io',
        x_url: 'https://x.com/BullStraking',
        telegram_url: 'https://t.me/BullStrakingOfficial',
        decimals: 9,
        total_supply: 1000000000,
        circulating_supply: 750000000,
        price: 0.00042,
        market_cap: 315000,
        volume_24h: 92000,
        liquidity: 48000,
        price_change_1h: 4.20,
        price_change_24h: 32.40,
        price_change_7d: 110.00,
        ath: 0.00085,
        atl: 0.00005,
        rank: 9,
        status: 'active',
        listing_status: 'PROMOTED',
        verification_status: 'verified'
      }
    ];

    const insertToken = `INSERT OR REPLACE INTO tokens (
      chain, contract_address, name, symbol, logo_url, description,
      website_url, x_url, telegram_url, decimals, total_supply, circulating_supply,
      price, market_cap, volume_24h, liquidity, price_change_1h, price_change_24h, price_change_7d,
      ath, atl, rank, status, listing_status, verification_status, last_data_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    for (const t of tokens) {
      execute(insertToken, [
        t.chain, t.contract_address, t.name, t.symbol, t.logo_url, t.description,
        t.website_url, t.x_url, t.telegram_url, t.decimals, t.total_supply, t.circulating_supply,
        t.price, t.market_cap, t.volume_24h, t.liquidity, t.price_change_1h, t.price_change_24h, t.price_change_7d,
        t.ath, t.atl, t.rank, t.status, t.listing_status, t.verification_status
      ]);
    }

    // 3. Security Scans
    const allTokens = query('SELECT id, chain, contract_address, symbol FROM tokens');
    for (const tok of allTokens) {
      execute(`INSERT OR REPLACE INTO security_scans (
        token_id, chain, contract_address, honeypot, buy_tax, sell_tax, mintable,
        ownership, blacklist, proxy, risk_level, risk_score, raw_response, scanned_at
      ) VALUES (?, ?, ?, 0, 0.0, 0.0, 0, 'renounced', 0, 0, 'LOW', 98, '{"verified":true}', CURRENT_TIMESTAMP)`, [
        tok.id, tok.chain, tok.contract_address
      ]);

      // Seed 7 price points for sparkline
      const basePrice = tok.symbol === 'BULL' ? 0.00042 : 100;
      const now = Math.floor(Date.now() / 1000);
      for (let i = 6; i >= 0; i--) {
        const factor = 0.9 + Math.random() * 0.2;
        execute(`INSERT INTO token_price_history (token_id, timestamp, price, market_cap, volume)
          VALUES (?, ?, ?, ?, ?)`, [
          tok.id, now - (i * 86400), basePrice * factor, 1000000 * factor, 50000 * factor
        ]);
      }
    }

    // 4. Promoted Token Orders
    const bullToken = queryOne("SELECT id FROM tokens WHERE symbol = 'BULL'");
    const solToken = queryOne("SELECT id FROM tokens WHERE symbol = 'SOL'");
    const wifToken = queryOne("SELECT id FROM tokens WHERE symbol = 'WIF'");

    if (bullToken) {
      execute(`INSERT INTO promotion_orders (
        token_id, customer_name, customer_email, telegram_username, promotion_type,
        package_id, duration, start_at, end_at, price, currency, payment_status, order_status,
        ad_title, ad_description, created_at, approved_at
      ) VALUES (
        ?, 'Bull Team', 'admin@bullstraking.io', '@bulladmin', 'PROMOTED_TOKEN',
        'tier-7d', 7, datetime('now', '-1 day'), datetime('now', '+6 days'), 499.00, 'USDT',
        'completed', 'active', 'Official Bull Straking Community Asset', 'Exclusive discounts and tracking utility.',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`, [bullToken.id]);
    }

    if (wifToken) {
      execute(`INSERT INTO promotion_orders (
        token_id, customer_name, customer_email, telegram_username, promotion_type,
        package_id, duration, start_at, end_at, price, currency, payment_status, order_status,
        ad_title, ad_description, created_at, approved_at
      ) VALUES (
        ?, 'WIF Whale', 'wif@dogwifcoin.org', '@wifhat', 'PROMOTED_TOKEN',
        'tier-3d', 3, datetime('now', '-1 hour'), datetime('now', '+3 days'), 299.00, 'USDT',
        'completed', 'active', 'dogwifhat - Top Solana Meme', 'The iconic meme sensation.',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`, [wifToken.id]);
    }

    // 5. 8-Minute Rotational Ad Board Items
    execute(`DELETE FROM ad_boards`);
    execute(`INSERT INTO ad_boards (
      token_id, title, description, logo_url, website_url, x_url, telegram_url,
      banner_image, cta_url, start_at, end_at, duration, price, status, rotation_order
    ) VALUES 
    (
      ${bullToken ? bullToken.id : 'NULL'},
      'Bull Straking Alpha Club',
      'The premier high-speed memecoin tracking & verified security pipeline on Solana & EVM.',
      'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
      'https://bullstraking.io',
      'https://x.com/BullStraking',
      'https://t.me/BullStrakingOfficial',
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1200&auto=format&fit=crop',
      'https://bullstraking.io/alpha',
      datetime('now', '-1 day'),
      datetime('now', '+7 days'),
      8,
      199.00,
      'active',
      1
    ),
    (
      ${solToken ? solToken.id : 'NULL'},
      'Solana Ecosystem Hub',
      'Fast, low-cost decentralized finance, high throughput and next-gen memes.',
      'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
      'https://solana.com',
      'https://x.com/solana',
      'https://t.me/solana',
      'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?q=80&w=1200&auto=format&fit=crop',
      'https://solana.com/ecosystem',
      datetime('now', '-1 day'),
      datetime('now', '+7 days'),
      8,
      250.00,
      'active',
      2
    ),
    (
      ${wifToken ? wifToken.id : 'NULL'},
      'Dogwifhat Community Collective',
      'Hat stays on. Join over 100k holders in the most viral movement on Web3.',
      'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
      'https://dogwifcoin.org',
      'https://x.com/dogwifcoin',
      'https://t.me/dogwifcoin',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
      'https://dogwifcoin.org',
      datetime('now', '-1 day'),
      datetime('now', '+7 days'),
      8,
      180.00,
      'active',
      3
    );`);

    // 6. Banner Orders (Top Banner & Homepage Banner)
    execute(`DELETE FROM banner_orders`);
    execute(`INSERT INTO banner_orders (
      token_id, banner_image, target_url, placement, duration, start_at, end_at, price, payment_status, approval_status
    ) VALUES 
    (
      ${bullToken ? bullToken.id : 'NULL'},
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1400&auto=format&fit=crop',
      'https://bullstraking.io/promote',
      'top_banner',
      7,
      datetime('now', '-1 day'),
      datetime('now', '+6 days'),
      350.00,
      'completed',
      'approved'
    ),
    (
      ${wifToken ? wifToken.id : 'NULL'},
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1400&auto=format&fit=crop',
      'https://dogwifcoin.org',
      'homepage_banner',
      15,
      datetime('now', '-2 days'),
      datetime('now', '+13 days'),
      600.00,
      'completed',
      'approved'
    );`);

    // 7. Presales (PinkSale, PancakeSwap, DxSale, Gempad)
    execute(`DELETE FROM presales`);
    execute(`INSERT INTO presales (
      project_name, token_id, chain, launchpad, presale_url, website_url, x_url, telegram_url,
      start_at, end_at, soft_cap, hard_cap, progress_percent, status, featured
    ) VALUES 
    (
      'BullAI Autonomous Analytics',
      ${bullToken ? bullToken.id : 'NULL'},
      'solana-ecosystem',
      'PinkSale',
      'https://pinksale.finance/launchpad/bullai',
      'https://bullai.network',
      'https://x.com/BullAINetwork',
      'https://t.me/BullAINetwork',
      datetime('now', '-12 hours'),
      datetime('now', '+3 days'),
      50,
      150,
      68.4,
      'live',
      1
    ),
    (
      'KedoSwap Dex Protocol V2',
      NULL,
      'binance-smart-chain',
      'PancakeSwap',
      'https://pancakeswap.finance/ifo/kedo',
      'https://kedoswap.io',
      'https://x.com/KedoSwap',
      'https://t.me/KedoSwapCommunity',
      datetime('now', '+1 day'),
      datetime('now', '+5 days'),
      100,
      300,
      15.0,
      'upcoming',
      1
    ),
    (
      'CyberBase Meme Matrix',
      NULL,
      'base-ecosystem',
      'DxSale',
      'https://dxsale.app/cyberbase',
      'https://cyberbase.xyz',
      'https://x.com/CyberBase',
      'https://t.me/CyberBaseMeme',
      datetime('now', '-2 days'),
      datetime('now', '+1 day'),
      20,
      60,
      92.5,
      'live',
      0
    ),
    (
      'Ethereum Yield Aggregator',
      NULL,
      'ethereum-ecosystem',
      'Gempad',
      'https://gempad.app/presale/eyield',
      'https://eyield.finance',
      'https://x.com/EYieldFinance',
      'https://t.me/EYieldOfficial',
      datetime('now', '+3 days'),
      datetime('now', '+7 days'),
      40,
      120,
      0.0,
      'upcoming',
      0
    );`);

    // 8. Admin Logs
    execute(`INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_value, new_value)
      VALUES 
      ('system_admin', 'SYSTEM_INITIALIZE', 'DATABASE', 1, NULL, 'Bull Straking DB Seeded with 11 relational tables'),
      ('system_admin', 'TOKEN_APPROVE', 'tokens', ${bullToken ? bullToken.id : 1}, 'PENDING_REVIEW', 'LIVE')`);
  });

  console.log('[Seed] Database successfully seeded with all initial data!');
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
