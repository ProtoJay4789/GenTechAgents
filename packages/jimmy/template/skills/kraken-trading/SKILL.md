---
name: kraken-trading
description: AI-native CLI for trading crypto, stocks, forex, and derivatives on Kraken with portfolio intelligence, market analysis, and automated strategies
---

# Kraken Trading

AI-native CLI for trading crypto, stocks, forex, and derivatives on Kraken. Covers portfolio intelligence, market analysis, order execution, and automated strategies.

## Trigger

This skill activates when tasks involve cryptocurrency trading, portfolio analysis, market data retrieval, trading strategy execution, or Kraken exchange operations.

## Prerequisites

Requires the `kraken` CLI binary installed and authenticated.

## Core Capabilities

### Market Intelligence
```bash
# Get ticker data for a pair
kraken ticker BTCUSD -o json

# View order book depth
kraken orderbook BTCUSD --count 10 -o json

# Get OHLC candles
kraken ohlc BTCUSD --interval 60 -o json

# Stream live ticker data (NDJSON — parse line by line)
kraken ws ticker BTC/USD -o json
```

### Portfolio Intelligence
```bash
# Account balance
kraken balance -o json

# Extended balance with margin data
kraken balance --extended -o json

# Trade history
kraken trades -o json

# Ledger entries (filter by type: trades, deposits, withdrawals, staking)
kraken ledger --type trades -o json

# Fee tier info
kraken fees -o json

# Export trades/ledger to CSV
kraken export trades --format csv
```

### Spot Trading
```bash
# Place a limit buy order
kraken order buy BTCUSD 0.01 --type limit --price 50000 -o json

# Cancel an order
kraken cancel <order-id>

# Dead-man switch (auto-cancel after timeout)
kraken deadman 60
```

**Critical Rule**: Never execute live order commands without explicit user approval.

### Strategy Execution
- **DCA**: Dollar-cost averaging with configurable intervals
- **Grid Trading**: Automated grid bot with price levels
- **Rebalancing**: Portfolio rebalancing to target allocations
- **TWAP**: Time-weighted average price execution

### Risk Management
- Stop-loss and take-profit orders
- Drawdown circuit breakers
- Liquidation guards for futures positions
- Emergency position flattening

## Workflow

### For Market Analysis
1. Pull ticker data for relevant pairs
2. Analyze OHLC data for trends and volatility
3. Check order book depth for liquidity assessment
4. Present findings with actionable insights

### For Trade Execution
1. Retrieve current price for the pair
2. Validate order parameters (pair, amount, price)
3. **Require explicit user confirmation before executing**
4. Place the order and capture confirmation
5. Verify order placement and status

### For Portfolio Review
1. Pull account balances and valuations
2. Analyze trade history and P&L
3. Review fee tier and costs
4. Generate summary report

## Safety Guidelines

- Always confirm with user before placing orders
- Use limit orders by default (not market orders)
- Start with small amounts for new strategies
- Monitor positions and set stop-losses
- Use paper trading mode for strategy testing before going live
