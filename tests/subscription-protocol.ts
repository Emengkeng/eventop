import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SubscriptionProtocol } from "../target/types/subscription_protocol";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("subscription_protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SubscriptionProtocol as Program<SubscriptionProtocol>;

  // Test accounts
  let mint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let merchantTokenAccount: anchor.web3.PublicKey;
  let subscriptionWalletPDA: anchor.web3.PublicKey;
  let walletTokenAccount: anchor.web3.PublicKey;
  let merchantPlanPDA: anchor.web3.PublicKey;
  let subscriptionStatePDA: anchor.web3.PublicKey;

  const user = anchor.web3.Keypair.generate();
  const merchant = anchor.web3.Keypair.generate();
  const payer = (provider.wallet as anchor.Wallet).payer;

  const PLAN_ID = "basic_plan";
  const PLAN_NAME = "Basic Monthly Plan";
  const FEE_AMOUNT = new BN(1000000); // 1 token (6 decimals)
  const PAYMENT_INTERVAL = new BN(30 * 24 * 60 * 60); // 30 days in seconds

  before(async () => {
    // Airdrop SOL to test accounts
    const userAirdrop = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const merchantAirdrop = await provider.connection.requestAirdrop(
      merchant.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(userAirdrop);
    await provider.connection.confirmTransaction(merchantAirdrop);

    // Create mint
    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6 // 6 decimals
    );

    // Create token accounts
    const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      user.publicKey
    );
    userTokenAccount = userTokenAccountInfo.address;

    const merchantTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      merchant.publicKey
    );
    merchantTokenAccount = merchantTokenAccountInfo.address;

    // Mint tokens to user
    await mintTo(
      provider.connection,
      payer,
      mint,
      userTokenAccount,
      payer,
      10000000000 // 10,000 tokens
    );
  });

  describe("Subscription Wallet Management", () => {
    it("Creates a subscription wallet", async () => {
      [subscriptionWalletPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription_wallet"),
          user.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      // Create wallet token account keypair
      const walletTokenAccountKp = anchor.web3.Keypair.generate();
      walletTokenAccount = walletTokenAccountKp.publicKey;

      const tx = await program.methods
        .createSubscriptionWallet()
        .accounts({
          // subscriptionWallet: subscriptionWalletPDA,
          mainTokenAccount: walletTokenAccount,
          user: user.publicKey,
          mint: mint,
          // tokenProgram: TOKEN_PROGRAM_ID,
          // systemProgram: anchor.web3.SystemProgram.programId,
         // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user, walletTokenAccountKp])
        .rpc();

      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );

      assert.equal(
        walletAccount.owner.toString(),
        user.publicKey.toString()
      );
      assert.equal(walletAccount.mint.toString(), mint.toString());
      assert.equal(walletAccount.totalSubscriptions, 0);
      assert.equal(walletAccount.totalSpent.toString(), "0");
      assert.equal(walletAccount.isYieldEnabled, false);
    });

    it("Deposits funds to subscription wallet", async () => {
      const depositAmount = new BN(5000000000); // 5,000 tokens

      // Create dummy yield vault account
      const yieldVault = anchor.web3.Keypair.generate();

      await program.methods
        .depositToWallet(depositAmount)
        .accounts({
         // subscriptionWallet: subscriptionWalletPDA,
          user: user.publicKey,
          userTokenAccount: userTokenAccount,
          walletTokenAccount: walletTokenAccount,
          yieldVaultAccount: yieldVault.publicKey,
         // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const walletTokenAccountInfo = await provider.connection.getTokenAccountBalance(
        walletTokenAccount
      );

      assert.equal(
        walletTokenAccountInfo.value.amount,
        depositAmount.toString()
      );
    });

    it("Withdraws idle funds from subscription wallet", async () => {
      const withdrawAmount = new BN(1000000000); // 1,000 tokens

      const yieldVault = anchor.web3.Keypair.generate();

      const userBalanceBefore = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );

      await program.methods
        .withdrawFromWallet(withdrawAmount)
        .accounts({
         // subscriptionWallet: subscriptionWalletPDA,
         // owner: user.publicKey,
          userTokenAccount: userTokenAccount,
          walletTokenAccount: walletTokenAccount,
          yieldVaultAccount: yieldVault.publicKey,
         // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const userBalanceAfter = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );

      const balanceIncrease = new BN(userBalanceAfter.value.amount).sub(
        new BN(userBalanceBefore.value.amount)
      );

      assert.equal(balanceIncrease.toString(), withdrawAmount.toString());
    });

    it("Enables yield on subscription wallet", async () => {
      const yieldVault = anchor.web3.Keypair.generate();

      await program.methods
        .enableYield({ marginfiLend: {} })
        .accounts({
         // subscriptionWallet: subscriptionWalletPDA,
          // owner: user.publicKey,
          yieldVault: yieldVault.publicKey,
        })
        .signers([user])
        .rpc();

      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );

      assert.equal(walletAccount.isYieldEnabled, true);
      assert.equal(
        walletAccount.yieldVault.toString(),
        yieldVault.publicKey.toString()
      );
    });
  });

  describe("Merchant Plan Management", () => {
    it("Registers a merchant plan", async () => {
      [merchantPlanPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("merchant_plan"),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
          Buffer.from(PLAN_ID),
        ],
        program.programId
      );

      await program.methods
        .registerMerchant(
          PLAN_ID,
          PLAN_NAME,
          FEE_AMOUNT,
          PAYMENT_INTERVAL
        )
        .accounts({
          // merchantPlan: merchantPlanPDA,
          merchant: merchant.publicKey,
          mint: mint,
          // systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([merchant])
        .rpc();

      const planAccount = await program.account.merchantPlan.fetch(
        merchantPlanPDA
      );

      assert.equal(
        planAccount.merchant.toString(),
        merchant.publicKey.toString()
      );
      assert.equal(planAccount.planId, PLAN_ID);
      assert.equal(planAccount.planName, PLAN_NAME);
      assert.equal(planAccount.feeAmount.toString(), FEE_AMOUNT.toString());
      assert.equal(
        planAccount.paymentInterval.toString(),
        PAYMENT_INTERVAL.toString()
      );
      assert.equal(planAccount.isActive, true);
      assert.equal(planAccount.totalSubscribers, 0);
    });
  });

  describe("Subscription Management", () => {
    it("Creates a subscription using wallet", async () => {
      [subscriptionStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription"),
          user.publicKey.toBuffer(),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      const yieldVault = anchor.web3.Keypair.generate();

      await program.methods
        .subscribeWithWallet()
        .accounts({
         // subscriptionState: subscriptionStatePDA,
        //  subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
          user: user.publicKey,
          walletTokenAccount: walletTokenAccount,
          walletYieldVault: yieldVault.publicKey,
         // systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      const subscriptionAccount = await program.account.subscriptionState.fetch(
        subscriptionStatePDA
      );

      assert.equal(
        subscriptionAccount.user.toString(),
        user.publicKey.toString()
      );
      assert.equal(
        subscriptionAccount.subscriptionWallet.toString(),
        subscriptionWalletPDA.toString()
      );
      assert.equal(
        subscriptionAccount.merchant.toString(),
        merchant.publicKey.toString()
      );
      assert.equal(subscriptionAccount.isActive, true);
      assert.equal(subscriptionAccount.paymentCount, 0);

      // Check wallet subscription count increased
      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );
      assert.equal(walletAccount.totalSubscriptions, 1);

      // Check merchant plan subscriber count increased
      const planAccount = await program.account.merchantPlan.fetch(
        merchantPlanPDA
      );
      assert.equal(planAccount.totalSubscribers, 1);
    });

    it("Executes payment from wallet and merchant receives funds", async () => {
      const yieldVault = anchor.web3.Keypair.generate();

      // Get initial balances
      const merchantBalanceBefore = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );
      const walletBalanceBefore = await provider.connection.getTokenAccountBalance(
        walletTokenAccount
      );
      
      const subscriptionBefore = await program.account.subscriptionState.fetch(
        subscriptionStatePDA
      );

      console.log("\n💰 Payment Execution Test:");
      console.log("  Merchant balance before:", merchantBalanceBefore.value.uiAmount);
      console.log("  Wallet balance before:", walletBalanceBefore.value.uiAmount);
      console.log("  Fee amount:", FEE_AMOUNT.toString());

      // Execute payment
      const tx = await program.methods
        .executePaymentFromWallet()
        .accounts({
          // subscriptionState: subscriptionStatePDA,
         // subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
          walletTokenAccount: walletTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
         // walletYieldVault: yieldVault.publicKey,
         // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("  Transaction signature:", tx);

      // Verify subscription state updated
      const subscriptionAfter = await program.account.subscriptionState.fetch(
        subscriptionStatePDA
      );

      assert.equal(subscriptionAfter.paymentCount, 1);
      assert.equal(
        subscriptionAfter.totalPaid.toString(),
        FEE_AMOUNT.toString()
      );
      assert.isAbove(
        subscriptionAfter.lastPaymentTimestamp.toNumber(),
        subscriptionBefore.lastPaymentTimestamp.toNumber()
      );

      // Verify merchant received payment
      const merchantBalanceAfter = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      const merchantBalanceIncrease = new BN(merchantBalanceAfter.value.amount).sub(
        new BN(merchantBalanceBefore.value.amount)
      );

      console.log("  Merchant balance after:", merchantBalanceAfter.value.uiAmount);
      console.log("  Merchant received:", merchantBalanceIncrease.toString());

      assert.equal(
        merchantBalanceIncrease.toString(),
        FEE_AMOUNT.toString(),
        "Merchant should receive exact fee amount"
      );

      // Verify wallet balance decreased
      const walletBalanceAfter = await provider.connection.getTokenAccountBalance(
        walletTokenAccount
      );

      const walletBalanceDecrease = new BN(walletBalanceBefore.value.amount).sub(
        new BN(walletBalanceAfter.value.amount)
      );

      console.log("  Wallet balance after:", walletBalanceAfter.value.uiAmount);
      console.log("  Wallet paid:", walletBalanceDecrease.toString());

      assert.equal(
        walletBalanceDecrease.toString(),
        FEE_AMOUNT.toString(),
        "Wallet should be debited exact fee amount"
      );

      // Verify wallet total spent increased
      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );
      assert.equal(
        walletAccount.totalSpent.toString(),
        FEE_AMOUNT.toString()
      );

      console.log("  ✅ Payment executed successfully!\n");
    });

    it("Executes multiple payments and tracks merchant earnings", async () => {
      // Create a new subscription for multi-payment test
      const user2 = anchor.web3.Keypair.generate();
      
      const airdrop = await provider.connection.requestAirdrop(
        user2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      // Create token account and mint tokens
      const user2TokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        user2.publicKey
      );

      await mintTo(
        provider.connection,
        payer,
        mint,
        user2TokenAccountInfo.address,
        payer,
        10000000000
      );

      // Create wallet and subscription for user2
      const [user2WalletPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription_wallet"),
          user2.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      const user2WalletTokenKp = anchor.web3.Keypair.generate();

      await program.methods
        .createSubscriptionWallet()
        .accounts({
         // subscriptionWallet: user2WalletPDA,
          mainTokenAccount: user2WalletTokenKp.publicKey,
          user: user2.publicKey,
          mint: mint,
          // tokenProgram: TOKEN_PROGRAM_ID,
          // systemProgram: anchor.web3.SystemProgram.programId,
         // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user2, user2WalletTokenKp])
        .rpc();

      // Deposit to wallet
      await program.methods
        .depositToWallet(new BN(5000000000))
        .accounts({
         // subscriptionWallet: user2WalletPDA,
          user: user2.publicKey,
          userTokenAccount: user2TokenAccountInfo.address,
          walletTokenAccount: user2WalletTokenKp.publicKey,
          yieldVaultAccount: anchor.web3.Keypair.generate().publicKey,
         // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      // Subscribe
      const [user2SubPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription"),
          user2.publicKey.toBuffer(),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .subscribeWithWallet()
        .accounts({
        //  subscriptionState: user2SubPDA,
         // subscriptionWallet: user2WalletPDA,
          merchantPlan: merchantPlanPDA,
          user: user2.publicKey,
          walletTokenAccount: user2WalletTokenKp.publicKey,
          walletYieldVault: anchor.web3.Keypair.generate().publicKey,
        //  systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      // Track merchant balance
      const merchantBalanceStart = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      console.log("\n💰 Multi-Payment Test:");
      console.log("  Merchant starting balance:", merchantBalanceStart.value.uiAmount);

      // Execute 3 payments
      for (let i = 1; i <= 3; i++) {
        await program.methods
          .executePaymentFromWallet()
          .accounts({
          //  subscriptionState: user2SubPDA,
          //  subscriptionWallet: user2WalletPDA,
            merchantPlan: merchantPlanPDA,
            walletTokenAccount: user2WalletTokenKp.publicKey,
            merchantTokenAccount: merchantTokenAccount,
          //  walletYieldVault: anchor.web3.Keypair.generate().publicKey,
           // tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const currentBalance = await provider.connection.getTokenAccountBalance(
          merchantTokenAccount
        );
        console.log(`  After payment ${i}:`, currentBalance.value.uiAmount);
      }

      // Verify final merchant balance
      const merchantBalanceEnd = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      const totalReceived = new BN(merchantBalanceEnd.value.amount).sub(
        new BN(merchantBalanceStart.value.amount)
      );

      const expectedTotal = FEE_AMOUNT.mul(new BN(3));

      console.log("  Total received by merchant:", totalReceived.toString());
      console.log("  Expected total:", expectedTotal.toString());

      assert.equal(
        totalReceived.toString(),
        expectedTotal.toString(),
        "Merchant should receive 3x fee amount"
      );

      // Verify subscription payment count
      const subscription = await program.account.subscriptionState.fetch(user2SubPDA);
      assert.equal(subscription.paymentCount, 3);
      assert.equal(
        subscription.totalPaid.toString(),
        expectedTotal.toString()
      );

      console.log("  ✅ All payments executed successfully!\n");
    });

    it("Cancels subscription", async () => {
      await program.methods
        .cancelSubscriptionWallet()
        .accounts({
          //subscriptionState: subscriptionStatePDA,
          subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
         // user: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Subscription account should be closed
      try {
        await program.account.subscriptionState.fetch(subscriptionStatePDA);
        assert.fail("Subscription account should be closed");
      } catch (error) {
        assert.include(error.toString(), "Account does not exist");
      }

      // Check wallet subscription count decreased
      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );
      assert.equal(walletAccount.totalSubscriptions, 0);

      // Check merchant plan subscriber count decreased
      const planAccount = await program.account.merchantPlan.fetch(
        merchantPlanPDA
      );
      assert.equal(planAccount.totalSubscribers, 0);
    });
  });

  describe("Yield Management", () => {
    it("Claims yield rewards", async () => {
      // This test assumes yield has been earned
      // In production, this would need actual yield protocol integration

      const yieldVault = anchor.web3.Keypair.generate();

      try {
        await program.methods
          .claimYieldRewards()
          .accounts({
          //  subscriptionWallet: subscriptionWalletPDA,
          //  owner: user.publicKey,
            userTokenAccount: userTokenAccount,
            walletTokenAccount: walletTokenAccount,
            yieldVaultAccount: yieldVault.publicKey,
           // tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
      } catch (error) {
        // Expected to fail with NoYieldToClaim since we're using placeholder functions
        assert.include(error.toString(), "NoYieldToClaim");
      }
    });
  });

  describe("Error Handling", () => {
    it("Fails to create subscription with insufficient balance", async () => {
      // Create a new user with low balance
      const poorUser = anchor.web3.Keypair.generate();
      
      const airdrop = await provider.connection.requestAirdrop(
        poorUser.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      const [poorUserWalletPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription_wallet"),
          poorUser.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      const poorUserTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        poorUser.publicKey
      );

      // Mint only 1 token (less than 3 months buffer)
      await mintTo(
        provider.connection,
        payer,
        mint,
        poorUserTokenAccountInfo.address,
        payer,
        1000000 // 1 token
      );

      const walletTokenAccountKp = anchor.web3.Keypair.generate();

      // Create wallet
      await program.methods
        .createSubscriptionWallet()
        .accounts({
        //  subscriptionWallet: poorUserWalletPDA,
          mainTokenAccount: walletTokenAccountKp.publicKey,
          user: poorUser.publicKey,
          mint: mint,
        //  tokenProgram: TOKEN_PROGRAM_ID,
        //  systemProgram: anchor.web3.SystemProgram.programId,
        //  rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([poorUser, walletTokenAccountKp])
        .rpc();

      // Deposit to wallet
      await program.methods
        .depositToWallet(new BN(1000000))
        .accounts({
        //  subscriptionWallet: poorUserWalletPDA,
          user: poorUser.publicKey,
          userTokenAccount: poorUserTokenAccountInfo.address,
          walletTokenAccount: walletTokenAccountKp.publicKey,
          yieldVaultAccount: anchor.web3.Keypair.generate().publicKey,
        //  tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([poorUser])
        .rpc();

      const [poorUserSubPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription"),
          poorUser.publicKey.toBuffer(),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .subscribeWithWallet()
          .accounts({
          ///  subscriptionState: poorUserSubPDA,
          //  subscriptionWallet: poorUserWalletPDA,
            merchantPlan: merchantPlanPDA,
            user: poorUser.publicKey,
            walletTokenAccount: walletTokenAccountKp.publicKey,
            walletYieldVault: anchor.web3.Keypair.generate().publicKey,
          //  systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([poorUser])
          .rpc();
        
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        assert.include(error.toString(), "InsufficientWalletBalance");
      }
    });

    it("Fails to execute payment with insufficient wallet balance", async () => {
      // Create a new subscription that will run out of funds
      const emptyUser = anchor.web3.Keypair.generate();
      
      const airdrop = await provider.connection.requestAirdrop(
        emptyUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      const emptyUserTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        emptyUser.publicKey
      );

      // Mint exactly 3 months worth (minimum buffer)
      const minimumAmount = FEE_AMOUNT.mul(new BN(3));
      await mintTo(
        provider.connection,
        payer,
        mint,
        emptyUserTokenAccountInfo.address,
        payer,
        minimumAmount.toNumber()
      );

      const [emptyWalletPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription_wallet"),
          emptyUser.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      const emptyWalletTokenKp = anchor.web3.Keypair.generate();

      await program.methods
        .createSubscriptionWallet()
        .accounts({
         // subscriptionWallet: emptyWalletPDA,
          mainTokenAccount: emptyWalletTokenKp.publicKey,
          user: emptyUser.publicKey,
          mint: mint,
        //  tokenProgram: TOKEN_PROGRAM_ID,
       //  systemProgram: anchor.web3.SystemProgram.programId,
        //  rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([emptyUser, emptyWalletTokenKp])
        .rpc();

      await program.methods
        .depositToWallet(minimumAmount)
        .accounts({
       //   subscriptionWallet: emptyWalletPDA,
          user: emptyUser.publicKey,
          userTokenAccount: emptyUserTokenAccountInfo.address,
          walletTokenAccount: emptyWalletTokenKp.publicKey,
          yieldVaultAccount: anchor.web3.Keypair.generate().publicKey,
        //  tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([emptyUser])
        .rpc();

      const [emptySubPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription"),
          emptyUser.publicKey.toBuffer(),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .subscribeWithWallet()
        .accounts({
        //  subscriptionState: emptySubPDA,
        //  subscriptionWallet: emptyWalletPDA,
          merchantPlan: merchantPlanPDA,
          user: emptyUser.publicKey,
          walletTokenAccount: emptyWalletTokenKp.publicKey,
          walletYieldVault: anchor.web3.Keypair.generate().publicKey,
        //  systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([emptyUser])
        .rpc();

      console.log("\n💸 Testing insufficient balance scenario:");

      // Execute 3 payments successfully
      for (let i = 1; i <= 3; i++) {
        await program.methods
          .executePaymentFromWallet()
          .accounts({
          //  subscriptionState: emptySubPDA,
          //  subscriptionWallet: emptyWalletPDA,
            merchantPlan: merchantPlanPDA,
            walletTokenAccount: emptyWalletTokenKp.publicKey,
            merchantTokenAccount: merchantTokenAccount,
          //  walletYieldVault: anchor.web3.Keypair.generate().publicKey,
          //  tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        console.log(`  Payment ${i}: ✅ Success`);
      }

      // 4th payment should fail - wallet is empty
      try {
        await program.methods
          .executePaymentFromWallet()
          .accounts({
          //  subscriptionState: emptySubPDA,
          //  subscriptionWallet: emptyWalletPDA,
            merchantPlan: merchantPlanPDA,
            walletTokenAccount: emptyWalletTokenKp.publicKey,
            merchantTokenAccount: merchantTokenAccount,
          //  walletYieldVault: anchor.web3.Keypair.generate().publicKey,
          //  tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        assert.include(error.toString(), "InsufficientWalletBalance");
        console.log("  Payment 4: ❌ Failed (expected - insufficient balance)");
      }

      console.log("  ✅ Insufficient balance protection working!\n");
    });

    it("Fails to enable yield twice", async () => {
      const yieldVault = anchor.web3.Keypair.generate();

      try {
        await program.methods
          .enableYield({ kaminoLend: {} })
          .accounts({
          //  subscriptionWallet: subscriptionWalletPDA,
          //  owner: user.publicKey,
            yieldVault: yieldVault.publicKey,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have failed with YieldAlreadyEnabled");
      } catch (error) {
        assert.include(error.toString(), "YieldAlreadyEnabled");
      }
    });

    it("Fails to execute payment on cancelled subscription", async () => {
      // The subscription was already cancelled in previous test
      // Try to execute payment on it
      try {
        await program.methods
          .executePaymentFromWallet()
          .accounts({
          //  subscriptionState: subscriptionStatePDA,
          //  subscriptionWallet: subscriptionWalletPDA,
            merchantPlan: merchantPlanPDA,
            walletTokenAccount: walletTokenAccount,
            merchantTokenAccount: merchantTokenAccount,
          //  walletYieldVault: anchor.web3.Keypair.generate().publicKey,
          //  tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        assert.fail("Should have failed - subscription is cancelled");
      } catch (error) {
        // Account is closed, so we get an account error
        assert.include(error.toString(), "Account does not exist");
      }
    });
  });

  describe("Backend Scheduler Simulation", () => {
    let schedulerWallet: anchor.web3.Keypair;
    let schedulerSubscription: anchor.web3.PublicKey;
    let schedulerSubWallet: anchor.web3.PublicKey;

    before("Setup for scheduler tests", async () => {
      // Create scheduler test user
      schedulerWallet = anchor.web3.Keypair.generate();
      
      const airdrop = await provider.connection.requestAirdrop(
        schedulerWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      // Create token account
      const schedulerTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        mint,
        schedulerWallet.publicKey
      );

      await mintTo(
        provider.connection,
        payer,
        mint,
        schedulerTokenAccountInfo.address,
        payer,
        100000000000
      );

      // Create wallet
      [schedulerSubWallet] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription_wallet"),
          schedulerWallet.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      const schedulerWalletTokenKp = anchor.web3.Keypair.generate();

      await program.methods
        .createSubscriptionWallet()
        .accounts({
        //  subscriptionWallet: schedulerSubWallet,
          mainTokenAccount: schedulerWalletTokenKp.publicKey,
          user: schedulerWallet.publicKey,
          mint: mint,
        //  tokenProgram: TOKEN_PROGRAM_ID,
        //  systemProgram: anchor.web3.SystemProgram.programId,
        //  rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([schedulerWallet, schedulerWalletTokenKp])
        .rpc();

      await program.methods
        .depositToWallet(new BN(50000000000))
        .accounts({
        //  subscriptionWallet: schedulerSubWallet,
          user: schedulerWallet.publicKey,
          userTokenAccount: schedulerTokenAccountInfo.address,
          walletTokenAccount: schedulerWalletTokenKp.publicKey,
          yieldVaultAccount: anchor.web3.Keypair.generate().publicKey,
        //  tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([schedulerWallet])
        .rpc();

      // Subscribe
      [schedulerSubscription] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("subscription"),
          schedulerWallet.publicKey.toBuffer(),
          merchant.publicKey.toBuffer(),
          mint.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .subscribeWithWallet()
        .accounts({
        //  subscriptionState: schedulerSubscription,
        //  subscriptionWallet: schedulerSubWallet,
          merchantPlan: merchantPlanPDA,
          user: schedulerWallet.publicKey,
          walletTokenAccount: schedulerWalletTokenKp.publicKey,
          walletYieldVault: anchor.web3.Keypair.generate().publicKey,
        //  systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([schedulerWallet])
        .rpc();
    });

    it("Simulates backend scheduler executing payments over time", async () => {
      console.log("\n🤖 Backend Scheduler Simulation:");
      console.log("  Simulating 5 scheduled payment executions...\n");

      const merchantBalanceStart = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      // Simulate 5 payment cycles
      for (let cycle = 1; cycle <= 5; cycle++) {
        console.log(`  Cycle ${cycle}: Executing scheduled payment...`);

        // In production, your backend would:
        // 1. Query database for due payments
        // 2. Call execute_payment_from_wallet for each
        // 3. Update database with results

        const tx = await program.methods
          .executePaymentFromWallet()
          .accounts({
          //  subscriptionState: schedulerSubscription,
          //  subscriptionWallet: schedulerSubWallet,
            merchantPlan: merchantPlanPDA,
            walletTokenAccount: await getWalletTokenAccount(schedulerSubWallet),
            merchantTokenAccount: merchantTokenAccount,
          // walletYieldVault: anchor.web3.Keypair.generate().publicKey,
          //  tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const subscription = await program.account.subscriptionState.fetch(
          schedulerSubscription
        );

        console.log(`    ✅ Payment ${cycle} completed`);
        console.log(`    Signature: ${tx.slice(0, 20)}...`);
        console.log(`    Total payments: ${subscription.paymentCount}`);
        console.log(`    Total paid: ${subscription.totalPaid.toString()}\n`);

        // Small delay to simulate time between payments
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const merchantBalanceEnd = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      const totalReceived = new BN(merchantBalanceEnd.value.amount).sub(
        new BN(merchantBalanceStart.value.amount)
      );

      const expectedTotal = FEE_AMOUNT.mul(new BN(5));

      console.log(`  Final Results:`);
      console.log(`    Merchant received: ${totalReceived.toString()}`);
      console.log(`    Expected: ${expectedTotal.toString()}`);
      console.log(`    Match: ${totalReceived.toString() === expectedTotal.toString() ? '✅' : '❌'}\n`);

      assert.equal(
        totalReceived.toString(),
        expectedTotal.toString(),
        "Merchant should receive 5x fee amount"
      );
    });

    // Helper to get wallet token account
    async function getWalletTokenAccount(walletPDA: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> {
      const wallet = await program.account.subscriptionWallet.fetch(walletPDA);
      return wallet.mainTokenAccount;
    }
  });
});