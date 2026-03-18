---
name: solidity-auditor
description: Automated Solidity security audit tool using parallelized scanning agents for fast vulnerability detection during development
---

# Solidity Auditor

Automated security analysis of Solidity smart contracts through parallelized scanning agents. Provides fast (typically <5 min) security feedback on Solidity changes while you develop.

## Trigger

This skill activates when performing security audits on Solidity code, scanning for vulnerabilities in smart contracts, or when needing quick security feedback during development.

## Modes

- **Default**: Scans all `.sol` files excluding test/mock directories
- **Deep**: Includes adversarial reasoning agent for thorough analysis
- **File-specific**: Audits particular contracts only

## Excluded Paths

Automatically skips:
- `interfaces/`, `lib/`, `mocks/`, `test/` directories
- Files matching `*.t.sol`, `*Test*.sol`, `*Mock*.sol`

## Audit Workflow

### Turn 1: Discovery
1. Identify all in-scope `.sol` files
2. Locate reference materials and known vulnerability patterns
3. Filter out excluded paths

### Turn 2: Preparation
1. Read agent instructions and formatting guidelines
2. Bundle code files for each scanning agent
3. Prepare attack vector references

### Turn 3: Execution
1. Spawn 4 vector-scanning agents in parallel (each gets identical codebase but different attack vectors)
2. For deep mode: spawn adversarial reasoning agent with explicit file paths
3. Each agent independently analyzes the code for its assigned vulnerability class

### Turn 4: Reporting
1. Consolidate findings from all agents
2. Deduplicate by root cause
3. Sort by confidence level
4. Generate final report

## Output

Findings are sorted by confidence and include:
- Vulnerability description and location
- Severity classification
- Root cause analysis
- Recommended fix

Use `--file-output` flag to write results to markdown; without it, findings display in terminal only.

## Key Principles

- Multiple agents scanning in parallel catch more issues than a single pass
- Different attack vector references ensure diverse coverage
- Deduplication by root cause prevents noise
- Confidence sorting helps prioritize remediation
