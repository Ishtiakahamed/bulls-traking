-- Migration 005: Token Discovery & CoinGecko ID deduplication (PostgreSQL)
-- Adds coingecko_id to tokens and creates unique index on (chain, coingecko_id)

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS coingecko_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_chain_coingecko_id 
ON tokens(chain, coingecko_id) 
WHERE coingecko_id IS NOT NULL;
