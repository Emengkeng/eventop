# Subscription Protocol

A Solana-based subscription management system with yield-earning virtual wallets.

## Features

- **Subscription Wallets**: Virtual cards for managing recurring payments
- **Yield Integration**: Earn yield on idle funds via Marginfi, Kamino, Solend, or Drift
- **Protocol Fees**: Configurable fees (max 10%) on all transactions
- **Merchant Plans**: Create and manage subscription tiers
- **Auto-payments**: Execute recurring payments from wallet balance

## Core Instructions

- `initialize_protocol` - Set up protocol configuration
- `create_subscription_wallet` - Create a virtual wallet for subscriptions
- `enable_yield` - Activate yield earning on wallet funds
- `deposit_to_wallet` / `withdraw_from_wallet` - Manage wallet balance
- `register_merchant` - Create subscription plans
- `subscribe_with_wallet` - Start a subscription using wallet funds
- `execute_payment_from_wallet` - Process recurring payments
- `cancel_subscription_wallet` - End subscription (funds remain in wallet)
- `claim_yield_rewards` - Withdraw earned yield

## Related Projects

- [Mobile App](https://github.com/Emengkeng/eventop-mobile-app)
- [Merchant Dashboard](https://github.com/eventop-s/demo-app.git)
- [Web App](https://github.com/Emengkeng/eventop-web-app)
- [Server App](https://github.com/Emengkeng/eventop-server-app)
- [SDK](https://github.com/eventop-s/sdk)
- [Yield Implementation](/docs/yield.md)

## Program ID

```
GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2
```