# Eventop – Yield on Idle USDC (Implementation Plan)

## Overview

Eventop allows users to optionally earn yield on their idle USDC balances. This feature is **opt-in**, conservative by design, and prioritizes **payment availability over yield generation** at all times.

The core idea is simple:

* If a user’s USDC is sitting idle for a few months, it shouldn’t just sit there
* When enabled, Eventop supplies idle USDC to a conservative on-chain lending protocol on Solana
* When it’s time to deduct monthly payments, funds are always available

This is **not** marketed as passive income. Yield is treated as a **cost reducer**, not a profit engine.

---

## Design Principles

1. **USDC only**
   No exposure to SOL price volatility, LP risk, or impermanent loss.

2. **Opt-in by default**
   Users must explicitly enable yield.

3. **Payments-first architecture**
   Monthly deductions always take priority over earning yield.

4. **No lockups, no leverage**
   Funds must be withdrawable at any time.

5. **Conservative protocols only**
   Yield comes from lending, not token emissions or leverage.

---

## Protocol Choice (Initial)

**Jup Lend – USDC market**

Reason for starting with Jup:

* USDC-focused lending
* Instant / near-instant withdrawals
* Supports partial withdrawals
* Large TVL and battle-tested
* Predictable APY (typically ~7–12%)

We start with **one protocol only** to reduce surface area and complexity.

Future versions may diversify into other USDC lending markets (e.g. MarginFi), but not at launch.

---

## High-Level Flow

1. User deposits USDC into Eventop
2. User enables "Earn on idle balance"
3. Eventop deploys USDC into yield according to internal rules
4. Yield accrues continuously
5. Monthly deductions are handled automatically
6. User can disable yield at any time

---

## Internal Fund Structure

Even if users see their **full balance earning**, internally funds are split into two logical buckets:

### 1. Liquidity Buffer (10–15%)

* Held as raw USDC
* Used for monthly deductions
* Zero smart contract risk
* Ensures deductions do not depend on protocol exits

### 2. Yield Pool (85–90%)

* Supplied to Jup Lend (USDC)
* Earning variable yield
* Withdrawn from only when necessary

This split is internal and not exposed to the user.

---

## Monthly Deduction Logic

At each billing cycle:

1. Check if liquidity buffer >= deduction amount

   * If yes → deduct directly from buffer
2. If buffer < deduction amount

   * Withdraw only the required amount from Jup
   * Complete the deduction
3. After deduction

   * Check buffer ratio
   * Refill buffer from yield pool if below target

Payments are **never blocked** by yield generation.

---

## Rebalancing Rules

* Target buffer ratio: **10–15%** of total user balance
* Rebalance triggers:

  * After each deduction
  * Periodic safety rebalance (e.g. weekly)

Rebalancing is batched where possible to reduce on-chain operations.

---

## Small Balances

The system supports small balances (e.g. $3–$10 USDC), but with realistic expectations:

* Yield earned is small but real
* Precision and rounding are handled carefully
* On-chain actions are aggregated to avoid micro-withdrawals

Yield for small balances is treated as **value preservation**, not income.

---

## Disabling Yield

When a user disables yield:

1. Withdraw full remaining balance from Jup
2. Move funds to liquidity buffer
3. User balance becomes fully liquid

No lockups. No cooldowns.

---

## Risk Management

Key risks and mitigations:

* **Smart contract risk**
  → Use audited, conservative lending protocols only

* **Liquidity risk**
  → Maintain internal buffer

* **Yield volatility**
  → Do not guarantee APY

* **Protocol pause**
  → Buffer allows time to disable yield safely

---

## User-Facing Messaging (Guiding Principle)

We do not advertise APY.

Instead, users see:

* Estimated earnings over upcoming billing periods
* Clear explanation that yield is optional and variable

Example:

> "If your balance stays unused for a few months, you can choose to earn a small on-chain yield instead of letting it sit idle."

---

## Summary

* Yield is optional and conservative
* USDC-only, no price volatility
* Payments always come first
* Jup Lend is the initial protocol
* Designed for predictability, not speculation

This approach aligns with Eventop’s goal of being reliable, transparent, and user-first while still taking advantage of on-chain efficiency.
