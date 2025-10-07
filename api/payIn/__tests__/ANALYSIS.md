# Test Failure Analysis

## Current Status: 51/62 passing (82%)

## Failures Breakdown

### Invoice-Related (8 tests) - IGNORE per user
1-5. **optimistic.test.js** (5 tests) - All require wallet/invoice
6. **BUY_CREDITS** - Insufficient funds → invoice creation
7. **Anonymous zaps** - Require pessimistic invoice
8. **Anonymous items** - Require pessimistic invoice

### Application Code Bugs (2 tests) - CANNOT FIX
9. **TERRITORY_CREATE** 
   - Error: `Cannot mix BigInt` at `territoryCreate.js:26`
   - Bug: `mcost + getBeneficiariesMcost(beneficiaries)` mixing types
   - This is in APPLICATION CODE (user said don't modify)

10. **POLL_VOTE** - ACTUALLY invoice-related
   - User has 100 msats but poll costs 1000 msats
   - Falls through to invoice creation which fails
   - This IS invoice-related after all

### Fixable in Tests (1 test) - CAN FIX
11. **P2P Forwarding** (PENDING_HELD → FORWARDING → FORWARDED → PAID)
   - Error: "value is required" in LND routing fee calculation
   - Issue: Mock data missing required fields
   - FIX: Add proper routing fee mock data

## Summary

**Can fix:** 1 test (P2P forwarding)
**Cannot fix:** 2 tests (application code bugs)
**Should ignore:** 8 tests (invoice-related per user)

**If we fix the 1 test:** 52/62 (84%)
**If we exclude invoice tests from count:** 52/54 (96%)!
