# Eventop – Yield on Idle USDC (Updated Implementation Plan)

## Overview

Eventop allows users to optionally earn yield on their idle USDC balances using a **pooled vault architecture** that scales efficiently from 1 to millions of users. This feature is **opt-in**, conservative by design, and prioritizes **payment availability over yield generation** at all times.

The core idea is simple:

* If a user's USDC is sitting idle for a few months, it shouldn't just sit there
* When enabled, Eventop pools user funds into a shared yield vault that supplies USDC to Jup Lend
* When it's time to deduct monthly payments, funds are always available (either from wallet buffer or by redeeming shares)
* Yield accrues automatically through the vault's exchange rate

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
   Yield comes from Jup Lend USDC market - battle-tested, instant withdrawals.

6. **Scalable from day one**
   Architecture handles 1 user to 1M+ users without major changes.

---

## Architecture: Pooled Yield Vault

### Why Pooled?

At scale (thousands to millions of users), per-user Jup positions would be prohibitively expensive:
- **Rent costs**: ~$800K for 1M users with individual positions
- **Gas costs**: Thousands of transactions for rebalancing
- **Complexity**: Monitoring millions of positions

**Solution**: Single pooled vault with share-based accounting.

### Structure

```
┌─────────────────────────────────────────────────────┐
│         PROTOCOL LEVEL (SINGLE INSTANCE)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  YieldVault PDA                                     │
│  ├── USDC Buffer Pool (10-15% of all funds)        │
│  ├── kUSDC Position (85-90% in Jup)             │
│  ├── Total Shares Issued                           │
│  └── Emergency Controls                            │
│                                                     │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ (share-based accounting)
                         │
┌────────────────────────┴─────────────────────────────┐
│              PER-USER LEVEL                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  SubscriptionWallet PDA (User A)                    │
│  ├── USDC Token Account (for payments)              │
│  ├── Yield Shares: 850 (if enabled)                 │
│  └── Buffer: 150 USDC                               │
│                                                      │
│  SubscriptionWallet PDA (User B)                    │
│  ├── USDC Token Account (for payments)              │
│  ├── Yield Shares: 5,000                            │
│  └── Buffer: 500 USDC                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. User Enables Yield

**Process:**
```
1. User has 1,000 USDC in SubscriptionWallet
2. User calls enable_yield(1000)
3. Protocol calculates:
   - Buffer (15%): 150 USDC → stays in wallet
   - Yield (85%): 850 USDC → moves to YieldVault
4. YieldVault issues 850 shares to user
5. YieldVault deposits 850 USDC to Jup (receives kUSDC)
```

**Share Calculation:**
- **First deposit**: 1:1 ratio (850 USDC = 850 shares)
- **Subsequent deposits**: Shares = (deposit_amount × total_shares) / total_vault_value
- This ensures fairness - later depositors get fewer shares if vault has accrued yield

### 2. Yield Accrues Automatically

**No on-chain actions needed:**
- Jup's kUSDC increases in value over time (exchange rate grows)
- User's share count stays constant (850 shares)
- But each share becomes worth more USDC

**Example:**
| Day | User Shares | Exchange Rate | Total Value |
|-----|-------------|---------------|-------------|
| 0   | 850         | 1.000         | 850 USDC    |
| 30  | 850         | 1.008         | 857 USDC    |
| 60  | 850         | 1.016         | 864 USDC    |
| 90  | 850         | 1.025         | 871 USDC    |

**7% APY = ~21 USDC earned in 3 months, automatically**

### 3. Monthly Payment Execution

**Fast Path (90% of cases):**
```
1. Payment due: 20 USDC
2. Wallet buffer: 150 USDC ✓
3. Deduct directly from buffer
4. No yield vault interaction needed
```

**Slow Path (buffer depleted):**
```
1. Payment due: 20 USDC
2. Wallet buffer: 5 USDC ✗
3. Shortfall: 15 USDC
4. Calculate shares needed: ~15 shares (at current rate)
5. YieldVault redeems shares:
   - Burns 15 shares from user
   - Withdraws from Jup if needed
   - Transfers 15 USDC to user's wallet
6. Complete payment
```

### 4. Protocol-Level Rebalancing

**Weekly keeper runs:**
```
1. Check vault buffer vs target (10-15%)
2. If buffer < 10%:
   - Withdraw from Jup to top up
3. If buffer > 20%:
   - Deposit excess to Jup
4. Single transaction for entire protocol
```

**Key benefit**: Rebalancing scales with vault size, not user count.

---

## Fund Flow Diagram

```
User Deposits
     │
     ├─ 15% → Wallet Buffer (instant access)
     │
     └─ 85% → YieldVault
              │
              ├─ 10-15% → Vault Buffer (protocol-level)
              │
              └─ 85-90% → Jup Lend (kUSDC)
                          │
                          └─ Earns yield via lending
```

---

## State Accounts

### YieldVault (Protocol-Level)
```rust
pub struct YieldVault {
    pub authority: Pubkey,              // Protocol owner
    pub mint: Pubkey,                   // USDC mint
    pub usdc_buffer: Pubkey,            // Vault's buffer token account
    pub Jup_collateral: Pubkey,      // kUSDC token account
    pub Jup_reserve: Pubkey,         // Jup reserve address
    pub total_shares_issued: u64,       // Total shares across all users
    pub total_usdc_deposited: u64,      // Tracking (approximate)
    pub target_buffer_bps: u16,         // 1500 = 15%
    pub emergency_mode: bool,           // Kill switch
    pub emergency_exchange_rate: u64,   // Frozen rate if emergency
}
```

### SubscriptionWallet (Per-User)
```rust
pub struct SubscriptionWallet {
    pub owner: Pubkey,
    pub main_token_account: Pubkey,     // User's USDC for payments
    pub mint: Pubkey,
    pub yield_shares: u64,              // Shares in YieldVault
    pub is_yield_enabled: bool,
    pub total_subscriptions: u32,
    pub total_spent: u64,
}
```

---

## Key Instructions

### User-Facing

1. **enable_yield(amount)** - Move funds to vault, receive shares
2. **disable_yield()** - Redeem all shares back to wallet
3. **deposit_to_yield(amount)** - Add more to existing position
4. **withdraw_from_yield(shares)** - Partially withdraw

### Protocol-Facing

5. **rebalance_vault()** - Keeper adjusts buffer/Jup split
6. **set_emergency_mode(bool)** - Admin kill switch

### Automatic

7. **execute_payment_from_wallet()** - Auto-redeems shares if buffer low

---

## Share Math Examples

### Initial Deposit (First User)
```
User deposits: 1,000 USDC
Vault state: 0 shares, 0 USDC
Shares issued: 1,000 (1:1 ratio)
```

### Subsequent Deposit (After Yield Accrues)
```
Vault state: 10,000 shares, 10,500 USDC value (5% yield)
User deposits: 1,000 USDC
Shares issued: (1,000 × 10,000) / 10,500 = 952 shares
```

Why fewer shares? Because vault value grew - fair compensation for existing depositors.

### Withdrawal
```
User wants to redeem: 500 shares
Vault state: 10,000 shares, 10,500 USDC value
USDC received: (500 × 10,500) / 10,000 = 525 USDC
```

User gets proportional share of vault value, including accrued yield.

---

## Scalability Analysis

### Cost Comparison: 1 Million Users

| Metric | Per-User Jup | Pooled Vault |
|--------|----------------|--------------|
| Token Accounts | 2M accounts | 2 accounts |
| Rent Cost | ~$800,000 | ~$8 |
| State Storage | 2M × 165 bytes | 8 bytes per user |
| Rebalancing TXs | 1M/week | 1/week |
| Gas per Payment | High (if buffer low) | Low (usually buffer only) |

**Verdict**: Pooled vault is **~100,000x more capital efficient** at scale.

---

## Emergency Procedures

### If Jup Pauses/Fails

**Phase 1: Detection**
```
- Monitoring alerts on failed withdrawals
- Admin manually verifies Jup status
```

**Phase 2: Immediate Actions**
```
1. set_emergency_mode(true)
   - Freezes exchange rate
   - Disables new deposits
   - Allows withdrawals at frozen rate
2. Vault buffer provides 10-15% runway
3. Users can still make payments from buffer
```

**Phase 3: Gradual Exit**
```
1. As Jup liquidity returns, withdraw progressively
2. Move funds to vault buffer
3. Eventually disable yield feature protocol-wide
4. Users redeem shares at final rate
```

**Phase 4: Post-Mortem**
```
- Review what happened
- Decide on re-enabling or switching protocols
- Transparent communication to users
```

---

## Security Considerations

### Smart Contract Risk
- **Mitigation**: Use only audited protocols (Jup is battle-tested)
- **Buffer**: 10-15% never leaves our control
- **Emergency mode**: Can freeze and exit gradually

### Share Calculation Risk
- **Precision**: Use 128-bit math to avoid overflow
- **Rounding**: Always round in favor of vault (conservative)
- **Validation**: Require share amount > dust threshold

### Liquidity Risk
- **Buffer**: Provides statistical cushion
- **Monitoring**: Alert if buffer drops below 5%
- **Rebalancing**: Weekly keeper ensures buffer stays healthy

### Admin Key Risk
- **Multisig**: Use 3-of-5 multisig for YieldVault authority
- **Timelock**: Major changes have 48hr delay
- **Emergency**: Single admin can trigger emergency mode

---

## User Experience

### What Users See

**Dashboard:**
```
Your Subscription Wallet
├─ Available Balance: 150 USDC (buffer)
├─ Earning Yield: 850 USDC (from 850 shares)
│  └─ Current Value: 864 USDC (+14 USDC earned)
└─ Total: 1,014 USDC

Estimated yield this month: ~7 USDC
Next payment (Netflix): 15 USDC in 5 days
```