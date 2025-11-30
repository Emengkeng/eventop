/* eslint-disable prettier/prettier */
/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/subscription_protocol.json`.
 */
export type SubscriptionProtocol = {
  "address": "GPVtSfXPiy8y4SkJrMC3VFyKUmGVhMrRbAp2NhiW1Ds2",
  "metadata": {
    "name": "subscriptionProtocol",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelSubscriptionWallet",
      "docs": [
        "Cancel subscription (no refund needed, funds stay in wallet)"
      ],
      "discriminator": [
        87,
        116,
        152,
        140,
        138,
        150,
        126,
        195
      ],
      "accounts": [
        {
          "name": "subscriptionState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "subscription_state.user",
                "account": "subscriptionState"
              },
              {
                "kind": "account",
                "path": "subscription_state.merchant",
                "account": "subscriptionState"
              },
              {
                "kind": "account",
                "path": "subscription_state.mint",
                "account": "subscriptionState"
              }
            ]
          }
        },
        {
          "name": "subscriptionWallet",
          "writable": true
        },
        {
          "name": "merchantPlan",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "subscriptionState"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "claimYieldRewards",
      "docs": [
        "Claim accumulated yield rewards"
      ],
      "discriminator": [
        101,
        232,
        57,
        18,
        202,
        32,
        111,
        9
      ],
      "accounts": [
        {
          "name": "subscriptionWallet",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "subscriptionWallet"
          ]
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "walletTokenAccount"
        },
        {
          "name": "yieldVaultAccount"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createSubscriptionWallet",
      "docs": [
        "Create a Subscription Wallet (Virtual Card) for a user"
      ],
      "discriminator": [
        35,
        43,
        93,
        123,
        176,
        230,
        33,
        157
      ],
      "accounts": [
        {
          "name": "subscriptionWallet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mainTokenAccount",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositToWallet",
      "docs": [
        "Deposit funds into Subscription Wallet"
      ],
      "discriminator": [
        103,
        7,
        8,
        74,
        10,
        156,
        142,
        175
      ],
      "accounts": [
        {
          "name": "subscriptionWallet",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "walletTokenAccount",
          "writable": true
        },
        {
          "name": "yieldVaultAccount"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "enableYield",
      "docs": [
        "Enable yield earning on idle funds in Subscription Wallet"
      ],
      "discriminator": [
        196,
        201,
        147,
        154,
        193,
        54,
        141,
        13
      ],
      "accounts": [
        {
          "name": "subscriptionWallet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "subscriptionWallet"
          ]
        },
        {
          "name": "yieldVault"
        }
      ],
      "args": [
        {
          "name": "strategy",
          "type": {
            "defined": {
              "name": "yieldStrategy"
            }
          }
        }
      ]
    },
    {
      "name": "executePaymentFromWallet",
      "docs": [
        "Execute payment from Subscription Wallet"
      ],
      "discriminator": [
        65,
        124,
        135,
        175,
        165,
        95,
        251,
        172
      ],
      "accounts": [
        {
          "name": "subscriptionState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "subscription_state.user",
                "account": "subscriptionState"
              },
              {
                "kind": "account",
                "path": "subscription_state.merchant",
                "account": "subscriptionState"
              },
              {
                "kind": "account",
                "path": "subscription_state.mint",
                "account": "subscriptionState"
              }
            ]
          }
        },
        {
          "name": "subscriptionWallet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "merchantPlan"
        },
        {
          "name": "walletTokenAccount",
          "writable": true
        },
        {
          "name": "merchantTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "registerMerchant",
      "docs": [
        "Register merchant plan"
      ],
      "discriminator": [
        238,
        245,
        77,
        132,
        161,
        88,
        216,
        248
      ],
      "accounts": [
        {
          "name": "merchantPlan",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  99,
                  104,
                  97,
                  110,
                  116,
                  95,
                  112,
                  108,
                  97,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "merchant"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "planId"
              }
            ]
          }
        },
        {
          "name": "merchant",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "planId",
          "type": "string"
        },
        {
          "name": "planName",
          "type": "string"
        },
        {
          "name": "feeAmount",
          "type": "u64"
        },
        {
          "name": "paymentIntervalSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "subscribeWithWallet",
      "docs": [
        "Subscribe using Subscription Wallet (New approach!)"
      ],
      "discriminator": [
        8,
        120,
        11,
        42,
        170,
        6,
        72,
        80
      ],
      "accounts": [
        {
          "name": "subscriptionState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "merchant_plan.merchant",
                "account": "merchantPlan"
              },
              {
                "kind": "account",
                "path": "merchant_plan.mint",
                "account": "merchantPlan"
              }
            ]
          }
        },
        {
          "name": "subscriptionWallet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "merchantPlan",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "walletTokenAccount"
        },
        {
          "name": "walletYieldVault"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawFromWallet",
      "docs": [
        "Withdraw idle funds from Subscription Wallet"
      ],
      "discriminator": [
        197,
        40,
        222,
        231,
        38,
        226,
        168,
        174
      ],
      "accounts": [
        {
          "name": "subscriptionWallet",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  115,
                  99,
                  114,
                  105,
                  112,
                  116,
                  105,
                  111,
                  110,
                  95,
                  119,
                  97,
                  108,
                  108,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "subscription_wallet.owner",
                "account": "subscriptionWallet"
              },
              {
                "kind": "account",
                "path": "subscription_wallet.mint",
                "account": "subscriptionWallet"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "subscriptionWallet"
          ]
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "walletTokenAccount",
          "writable": true
        },
        {
          "name": "yieldVaultAccount"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "merchantPlan",
      "discriminator": [
        186,
        54,
        183,
        129,
        39,
        81,
        74,
        89
      ]
    },
    {
      "name": "subscriptionState",
      "discriminator": [
        35,
        41,
        45,
        165,
        253,
        34,
        95,
        225
      ]
    },
    {
      "name": "subscriptionWallet",
      "discriminator": [
        255,
        81,
        65,
        25,
        250,
        57,
        38,
        118
      ]
    }
  ],
  "events": [
    {
      "name": "paymentExecuted",
      "discriminator": [
        153,
        165,
        141,
        18,
        246,
        20,
        204,
        227
      ]
    },
    {
      "name": "subscriptionCancelled",
      "discriminator": [
        158,
        216,
        233,
        205,
        138,
        62,
        176,
        239
      ]
    },
    {
      "name": "subscriptionCreated",
      "discriminator": [
        215,
        63,
        169,
        25,
        179,
        200,
        180,
        105
      ]
    },
    {
      "name": "subscriptionWalletCreated",
      "discriminator": [
        235,
        235,
        143,
        233,
        3,
        163,
        185,
        76
      ]
    },
    {
      "name": "walletDeposit",
      "discriminator": [
        196,
        69,
        189,
        161,
        124,
        101,
        99,
        44
      ]
    },
    {
      "name": "walletWithdrawal",
      "discriminator": [
        27,
        160,
        208,
        232,
        130,
        95,
        216,
        219
      ]
    },
    {
      "name": "yieldClaimed",
      "discriminator": [
        177,
        201,
        94,
        68,
        19,
        200,
        227,
        27
      ]
    },
    {
      "name": "yieldEnabled",
      "discriminator": [
        21,
        224,
        190,
        160,
        201,
        113,
        52,
        41
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "subscriptionInactive",
      "msg": "Subscription is not active"
    },
    {
      "code": 6001,
      "name": "paymentTooEarly",
      "msg": "Payment interval has not elapsed yet"
    },
    {
      "code": 6002,
      "name": "planIdTooLong",
      "msg": "Plan ID exceeds maximum length"
    },
    {
      "code": 6003,
      "name": "planNameTooLong",
      "msg": "Plan name exceeds maximum length"
    },
    {
      "code": 6004,
      "name": "invalidFeeAmount",
      "msg": "Fee amount must be greater than zero"
    },
    {
      "code": 6005,
      "name": "invalidInterval",
      "msg": "Payment interval must be greater than zero"
    },
    {
      "code": 6006,
      "name": "planInactive",
      "msg": "Merchant plan is not active"
    },
    {
      "code": 6007,
      "name": "invalidMerchantPlan",
      "msg": "Invalid merchant plan reference"
    },
    {
      "code": 6008,
      "name": "unauthorizedCaller",
      "msg": "Caller is not authorized to execute payment"
    },
    {
      "code": 6009,
      "name": "unauthorizedCancellation",
      "msg": "Only the subscription user can cancel"
    },
    {
      "code": 6010,
      "name": "unauthorizedWalletAccess",
      "msg": "Unauthorized access to subscription wallet"
    },
    {
      "code": 6011,
      "name": "invalidDepositAmount",
      "msg": "Invalid deposit amount"
    },
    {
      "code": 6012,
      "name": "invalidWithdrawAmount",
      "msg": "Invalid withdrawal amount"
    },
    {
      "code": 6013,
      "name": "insufficientAvailableBalance",
      "msg": "Insufficient available balance in wallet"
    },
    {
      "code": 6014,
      "name": "insufficientWalletBalance",
      "msg": "Insufficient wallet balance for subscription"
    },
    {
      "code": 6015,
      "name": "invalidSubscriptionWallet",
      "msg": "Invalid subscription wallet reference"
    },
    {
      "code": 6016,
      "name": "yieldAlreadyEnabled",
      "msg": "Yield is already enabled"
    },
    {
      "code": 6017,
      "name": "yieldNotEnabled",
      "msg": "Yield is not enabled"
    },
    {
      "code": 6018,
      "name": "invalidYieldStrategy",
      "msg": "Invalid yield strategy"
    },
    {
      "code": 6019,
      "name": "noYieldToClaim",
      "msg": "No yield rewards to claim"
    },
    {
      "code": 6020,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in wallet"
    },
    {
      "code": 6021,
      "name": "invalidMerchantAccount",
      "msg": "Invalid merchant token account"
    },
    {
      "code": 6022,
      "name": "mathOverflow",
      "msg": "Math operation overflow"
    },
    {
      "code": 6023,
      "name": "merchantMismatch",
      "msg": "Merchant mismatch: subscription merchant does not match merchant plan"
    }
  ],
  "types": [
    {
      "name": "merchantPlan",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "planId",
            "type": "string"
          },
          {
            "name": "planName",
            "type": "string"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "paymentInterval",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "totalSubscribers",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subscriptionPda",
            "type": "pubkey"
          },
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "paymentNumber",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "subscriptionCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subscriptionPda",
            "type": "pubkey"
          },
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "paymentsMade",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "subscriptionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subscriptionPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "planId",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "subscriptionState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "subscriptionWallet",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "merchantPlan",
            "type": "pubkey"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "paymentInterval",
            "type": "i64"
          },
          {
            "name": "lastPaymentTimestamp",
            "type": "i64"
          },
          {
            "name": "totalPaid",
            "type": "u64"
          },
          {
            "name": "paymentCount",
            "type": "u32"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "subscriptionWallet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mainTokenAccount",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "yieldVault",
            "type": "pubkey"
          },
          {
            "name": "yieldStrategy",
            "type": {
              "defined": {
                "name": "yieldStrategy"
              }
            }
          },
          {
            "name": "isYieldEnabled",
            "type": "bool"
          },
          {
            "name": "totalSubscriptions",
            "type": "u32"
          },
          {
            "name": "totalSpent",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "subscriptionWalletCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "walletDeposit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "depositedToYield",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "walletWithdrawal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "yieldClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "yieldEnabled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "walletPda",
            "type": "pubkey"
          },
          {
            "name": "strategy",
            "type": "string"
          },
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "yieldStrategy",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "marginfiLend"
          },
          {
            "name": "kaminoLend"
          },
          {
            "name": "solendPool"
          },
          {
            "name": "driftDeposit"
          }
        ]
      }
    }
  ]
};
