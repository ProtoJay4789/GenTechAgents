---
name: solidity-contract-verification
description: Verify smart contracts on Etherscan V2 Multichain API across 60+ chains using Hardhat or direct API calls
---

# Solidity Contract Verification

Verify smart contracts on Etherscan, Basescan, and other block explorers using the Etherscan V2 Multichain API.

## Trigger

This skill activates when contracts are deployed but unverified, users request verification, compilation errors occur during verification, or complex dependencies need handling.

## Approaches

### Hardhat Verify Plugin (Simple Cases)
```bash
npx hardhat verify --network <network> <contract-address> [constructor-args...]
```

### Etherscan V2 API (Complex Cases)
Use the V2 Multichain API for greater control across 60+ supported chains with a single API key.

**Important**: The V1 API was fully deprecated on August 15, 2025 — use V2 endpoints only.

## Workflow

### Step 1: Prepare Source Code
1. Flatten the contract source: `npx hardhat flatten contracts/MyContract.sol > Flattened.sol`
2. **Remove Node.js warnings** from flattened output (lines starting with warnings)
3. **Remove duplicate SPDX and pragma statements** — keep only the first occurrence
4. Validate the flattened source compiles cleanly

### Step 2: Encode Constructor Arguments
If the contract has constructor parameters:
```javascript
const { AbiCoder } = require("ethers");
const coder = new AbiCoder();
const encoded = coder.encode(["address", "uint256"], [addr, amount]);
// Remove the "0x" prefix before submitting
const args = encoded.slice(2);
```

### Step 3: Submit Verification
```bash
curl -X POST "https://api.etherscan.io/v2/api?chainid=<CHAIN_ID>" \
  -d "module=contract" \
  -d "action=verifysourcecode" \
  -d "apikey=<API_KEY>" \
  -d "sourceCode=<FLATTENED_SOURCE>" \
  -d "contractaddress=<ADDRESS>" \
  -d "codeformat=solidity-single-file" \
  -d "contractname=<NAME>" \
  -d "compilerversion=<VERSION>" \
  -d "optimizationUsed=1" \
  -d "runs=200" \
  -d "constructorArguments=<ABI_ENCODED_ARGS>"
```

**Critical**: `chainid` must appear in the URL query parameters, NOT the POST body.

### Step 4: Check Status
Poll every 5 seconds for ~1 minute:
```bash
curl "https://api.etherscan.io/v2/api?chainid=<CHAIN_ID>&module=contract&action=checkverifystatus&guid=<GUID>&apikey=<API_KEY>"
```

## Common Issues

| Problem | Fix |
|---|---|
| Identifier parsing errors | Remove warning text from flattened files |
| Bytecode mismatch | Verify optimizer settings, run counts, exact compiler version |
| Constructor arg failure | Use proper ABI-encoding without "0x" prefix |
| V1 API errors | Migrate to V2 endpoints |

## Supported Chains

60+ chains including Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, and many more — all accessible with a single API key via the V2 endpoint.
