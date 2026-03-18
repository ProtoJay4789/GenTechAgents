---
name: security-framework-integration
description: Integrate ConsenSys/Trail of Bits smart contract security best practices into Foundry projects with documentation, patterns, and CI
---

# Security Framework Integration

Integrate comprehensive smart contract security best practices from ConsenSys and Trail of Bits into a Foundry project — including documentation, reusable security patterns, and automated tooling.

## Trigger

This skill activates when establishing security docs for new projects, incorporating security analysis into CI, creating reusable security patterns, or when someone says "add security best practices."

## Workflow

### Step 1: Documentation Structure
Create these directories and documents:
```
docs/
  KNOWN-ATTACKS.md       # Common vulnerabilities with examples
  SECURITY-PHILOSOPHY.md # Core security principles
  PATTERNS.md            # Secure coding patterns
  SECURITY-TOOLS.md      # Analysis tool guidance
  DEPLOYMENT-CHECKLIST.md # Pre-launch verification
  AUDIT_CHECKLIST.md     # Evolving audit findings
contracts/security/      # Reusable security abstracts
test/security/           # Security-focused tests
scripts/                 # Security scan scripts
```

### Step 2: Security Contracts
Implement reusable abstract contracts:
- **CommitReveal** — frontrunning protection pattern
- **OracleConsumer** — oracle response validation
- **PullPayment** — DoS-resistant payment transfers

### Step 3: Slither CI Integration
Add GitHub Actions workflow:
```yaml
name: Security Analysis
on: [push, pull_request]
jobs:
  slither:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: crytic/slither-action@v0.4.0
        with:
          fail-on: high
```

### Step 4: Local Security Scan Script
Create `scripts/security-scan.sh` that runs:
1. Format checks (`forge fmt --check`)
2. Compilation (`forge build`)
3. Tests (`forge test`)
4. Static analysis (`slither .`)
5. Gas report (`forge test --gas-report`)

### Step 5: README Updates
- Link all security documentation
- List available security contracts and their purposes
- Document the security scan workflow

### Step 6: Auditor Configuration
- Document workflows with external audit partners
- Set up audit finding tracking in AUDIT_CHECKLIST.md

## Verification Checklist

- [ ] All documentation files created and linked in README
- [ ] Security contracts compile successfully
- [ ] All tests pass including security tests
- [ ] Slither analysis runs cleanly
- [ ] CI pipeline includes security checks
- [ ] Local security scan script works end-to-end

## References

- ConsenSys Smart Contract Best Practices
- Trail of Bits — Building Secure Contracts
- SWC Registry (Smart Contract Weakness Classification)
- Smart Contract Security Field Guide
