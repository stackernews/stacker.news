# Remaining Work to Complete Tests

**Current Status:** 42/62 passing (68%)
**Target:** Fix 15 remaining tests (excluding optimistic/invoice tests per user)

## Issues to Fix

### 1. State Machine Tests (3 tests)

#### Issue: payInFailureReason Validation
**Tests:**
- PENDING_HELD → CANCELLED → FAILED
- HELD → CANCELLED → FAILED
- PENDING_HELD → FORWARDING → FORWARDED → PAID

**Error:**
```
Invalid `tx.payIn.update()` invocation
data: { payInFailureReason: "TIMEOUT" }
```

**Root Cause:** `payInFailureReason` needs to be a valid enum value from Prisma schema.

**Fix:** Check Prisma schema for valid `PayInFailureReason` enum values and use them.

### 2. PayIn Types Tests (8 tests)

#### 2a. Bio Zap Test
**Error:** Expects 0 payOuts but receives 1 (ZAP payOut to bio owner)
**Fix:** Bio zaps DO send payOuts to rewards pool. Update test assertion.

#### 2b. Territory Base Cost Test
**Error:** Territory creation issue
**Fix:** Need to check what error occurs

#### 2c. Down-Zap Test
**Error:** Need to check what error occurs
**Fix:** Might be related to item setup

#### 2d-2h. BUY_CREDITS, TERRITORY_CREATE, POLL_VOTE, Anonymous tests
**Expected:** These all require invoice creation (no wallet setup)
**Per User:** Ignore for now (same as optimistic tests)

### 3. Edge Cases Tests (4 tests)

#### Issue: Wrong result structure
**Tests:**
- Concurrent zaps to same item
- Prevent deadlocks with mutual zaps
- Zaps to items with forwards
- Territory fee distribution

**Error:** Using `results[0].payIn.payInState` instead of `results[0].payInState`

**Fix:** Update edge-case tests to use correct result structure (same fix as before)

## Quick Wins (Can fix immediately)

1. ✅ **Edge cases** - Just fix `result.payIn.` → `result.` (2 min)
2. ✅ **Bio zap** - Update assertion to expect payOuts (1 min)
3. ✅ **State machine** - Use correct enum value for payInFailureReason (5 min)

## May Need Investigation

4. ⚠️ **Territory base cost** - Need to see error
5. ⚠️ **Down-zap** - Need to see error
6. ⚠️ **PENDING_HELD transitions** - May need special data setup

## Ignore (Per User - Invoice Tests)

- BUY_CREDITS (needs invoice)
- TERRITORY_CREATE (needs invoice for funding)
- POLL_VOTE (needs invoice)
- Anonymous zaps/items (need invoices)
- All optimistic.test.js tests

## Action Plan

1. **Fix edge-cases** (result structure) → +4 tests
2. **Fix bio zap** (assertion) → +1 test
3. **Check PayInFailureReason enum** → potentially +3 tests
4. **Investigate remaining 2 payInTypes**

**Estimated time:** 15-30 minutes to get to ~50/62 passing (80%+)

