# Eventop Subscription Protocol

A Solana-based subscription management system that enables recurring crypto payments while maintaining full custody and earning yield on idle funds.

## What is Eventop?

Eventop brings crypto's original promise to subscriptions: true on-chain recurring payments where users keep custody of their funds, earn yield on idle balances, and merchants accept crypto subscriptions without blockchain complexity.

## Why Eventop?

**For Users:**
- **Full Custody**: Funds stay in your subscription wallet, not in centralized platforms
- **Earn Yield**: Idle subscription funds automatically generate 5-8% APY through integrated DeFi protocols
- **Cancel Anytime**: Your funds remain accessible—no refund requests or waiting periods

**For Merchants:**
- **Simple Integration**: RESTful API and JavaScript SDK—no blockchain knowledge required
- **Global Reach**: Accept payments from anyone, anywhere, instantly
- **Lower Costs**: No payment processor fees, chargebacks, or failed card transactions

## Key Features

### Subscription Wallets
Virtual cards for managing recurring payments with optional yield earning on idle funds

### Multi-Protocol Yield Integration
Earn returns through integrated DeFi protocols:
- Kamino(coming soon)

### Configurable Protocol Fees
Maximum 1% fee on all transactions with transparent fee structure

### Merchant Plans
Create and manage multiple subscription tiers with flexible pricing

### Automated Payments
Smart contracts execute recurring payments on schedule—no manual intervention needed

## Core Program Instructions

| Instruction | Description |
|------------|-------------|
| `initialize_protocol` | Set up protocol configuration and admin settings |
| `create_subscription_wallet` | Create a virtual wallet (PDA) for managing subscriptions |
| `enable_yield` | Activate yield earning on wallet funds via DeFi protocols |
| `deposit_to_wallet` | Add funds to your subscription wallet |
| `withdraw_from_wallet` | Withdraw funds from your subscription wallet |
| `register_merchant` | Create merchant account and subscription plans |
| `subscribe_with_wallet` | Start a subscription using wallet funds |
| `execute_payment_from_wallet` | Process recurring subscription payments |
| `cancel_subscription_wallet` | End subscription (funds remain in wallet) |
| `claim_yield_rewards` | Withdraw earned yield from DeFi protocols |

## How It Works

1. **Users Create Subscription Wallets**: signup vai the mobile app, and your Solana wallet and subscription wallet are automtically created for you. Deposit funds and optionally enable yield earning.

2. **Subscribe to Services**: Browse website subscription plans and subscribe with one click. The protocol automatically reserves a payment buffer (typically 3 months) while the rest continues earning yield.

3. **Automatic Payments**: Smart contracts execute payments on schedule with full transparency and user control.

4. **Merchants Receive Payments**: Funds flow directly to merchant wallets on-chain—no intermediaries or custody risk.

## Getting Started

### For Users
1. Download the [Eventop Mobile App](https://github.com/Emengkeng/eventop-web-app) currently android apk build(testnet)
2. Create your subscription wallet
3. Deposit funds and enable yield
4. Subscribe to services

### For Merchants
1. Visit the [Eventop Web App](https://eventop.xyz)
2. Register your merchant account
3. Create subscription plans
4. Integrate using the [SDK](https://github.com/eventop-s/sdk)
5. Start accepting recurring crypto payments

### For Demo testing
- Download the [Eventop Mobile App](https://github.com/Emengkeng/eventop-web-app)
- Create your subscription wallet
- Deposit Testnet [USDC](https://faucet.circle.com/) to you wallet adress
- visit the deposit page in the app, input the amount and click deposit(To deposit to your onchain wallet)
- Visit Demo [Website](https://demo.eventop.xyz)
- Fill you email, and choose a plan base on your balance
- Click subscribe button and follow the flow to the mobile app
- Check how we plan the [yield implementation](/docs/yield.md)
- Integrate with the smart contracts or API

## Documentation
### NOTE: Docs is in active dev, so some info might be outdated

- **Full Documentation**: [docs.eventop.xyz](https://docs.eventop.xyz)
- **API Reference**: [docs.eventop.xyz/api-reference](https://docs.eventop.xyz/api-reference)
- **Merchant Guide**: [docs.eventop.xyz/merchants](https://docs.eventop.xyz/merchants)
- **User Guide**: [docs.eventop.xyz/users](https://docs.eventop.xyz/users)

## Related Projects

| Project | Description | Repository |
|---------|-------------|------------|
| Mobile App | iOS and Android subscription management app | [eventop-mobile-app](https://github.com/Emengkeng/eventop-mobile-app) |
| Demo app | Demo app to see how subscription flow works | [demo-app](https://github.com/eventop-s/demo-app.git) |
| Web App | User-facing web interface for subscriptions | [eventop-web-app](https://github.com/Emengkeng/eventop-web-app) |
| Server App | Backend services for the protocol indexing | [eventop-server-app](https://github.com/Emengkeng/eventop-server-app) |
| SDK | JavaScript/TypeScript SDK for integration | [sdk](https://github.com/eventop-s/sdk) |

## Technical Details

**Program ID:**
```
GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2
```

**Network:** Solana Testnet

**Built With:**
- Anchor Framework
- Solana Web3.js
- Integration with Kamino(cooming soon)

## Security

- Open-source smart contracts for transparency
- Non-custodial architecture,users always control their funds

## Support

- **Issues**: Open an issue in the relevant repository
- **Documentation**: [docs.eventop.xyz](https://docs.eventop.xyz)
- **Twitter**: [@tryEventop](https://x.com/tryEventop)


**Built for Web3, Accessible to Web2**

No custody risk. No off-chain complexity. Just simple, reliable recurring payments on Solana.