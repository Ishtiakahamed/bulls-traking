# CoinGecko Integration Rules for Bulls Traking & Antigravity

This repository integrates CoinGecko API for cryptocurrency market analytics, real-time prices, trending tokens, global statistics, and on-chain GeckoTerminal liquidity pool data.

## Official Antigravity AI Tooling & Skills

- **CoinGecko SKILL**: Installed in `~/.gemini/config/skills/coingecko/SKILL.md`. Automatically provides endpoint schemas, query builders, and parameter references.
- **CoinGecko Live API MCP**: `https://mcp.api.coingecko.com/mcp` (or `https://mcp.pro-api.coingecko.com/mcp` with Pro API key).
- **CoinGecko Docs MCP**: `https://docs.coingecko.com/mcp` for searching CoinGecko guides, endpoint specifications, and tutorials.

---

## Authentication & Base URLs

| Tier | Base URL | Auth Header | Query Parameter |
| :--- | :--- | :--- | :--- |
| **Paid (Pro)** | `https://pro-api.coingecko.com/api/v3` | `x-cg-pro-api-key: <KEY>` | `?x_cg_pro_api_key=<KEY>` |
| **Demo** | `https://api.coingecko.com/api/v3` | `x-cg-demo-api-key: <KEY>` | `?x_cg_demo_api_key=<KEY>` |
| **Free (Keyless)** | `https://api.coingecko.com/api/v3` | *(Omit header)* | *(Omit parameter)* |

*Note: For on-chain / GeckoTerminal endpoints, append `/onchain` (e.g. `https://api.coingecko.com/api/v3/onchain/...`).*

---

## Environment Variables (.env)

```env
# CoinGecko API Configuration
COINGECKO_API_KEY=your_key_here
# Optional explicit tier overrides:
# COINGECKO_PRO_API_KEY=your_pro_key
# COINGECKO_DEMO_API_KEY=your_demo_key
# COINGECKO_PLAN=pro # or demo
```

---

## Best Practices & Guidelines

1. **Live Market Data**: Always fetch current token pricing, 24h volumes, market cap, and supply from live API calls.
2. **Rate Limits**:
   - Pro: 250+ calls/min.
   - Demo: 30 calls/min.
   - Free (Keyless): 5-10 calls/min (use cached fallback in DB when rate-limited).
3. **DexScreener & GeckoTerminal**: Use CoinGecko for aggregated multi-market tokens; use GeckoTerminal (`/onchain`) and DexScreener for newly launched microcap pairs and pool-level depth.
