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
          subscriptionWallet: subscriptionWalletPDA,
          mainTokenAccount: walletTokenAccount,
          user: user.publicKey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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
          subscriptionWallet: subscriptionWalletPDA,
          user: user.publicKey,
          userTokenAccount: userTokenAccount,
          walletTokenAccount: walletTokenAccount,
          yieldVaultAccount: yieldVault.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
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
          subscriptionWallet: subscriptionWalletPDA,
          owner: user.publicKey,
          userTokenAccount: userTokenAccount,
          walletTokenAccount: walletTokenAccount,
          yieldVaultAccount: yieldVault.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
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
          subscriptionWallet: subscriptionWalletPDA,
          owner: user.publicKey,
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
          merchantPlan: merchantPlanPDA,
          merchant: merchant.publicKey,
          mint: mint,
          systemProgram: anchor.web3.SystemProgram.programId,
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
          subscriptionState: subscriptionStatePDA,
          subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
          user: user.publicKey,
          walletTokenAccount: walletTokenAccount,
          walletYieldVault: yieldVault.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
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

    it("Executes payment from wallet", async () => {
      // Wait for payment interval (simulated by warping time in tests)
      // In production, use Clockwork or similar for scheduling

      const yieldVault = anchor.web3.Keypair.generate();

      const merchantBalanceBefore = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      await program.methods
        .executePaymentFromWallet()
        .accounts({
          subscriptionState: subscriptionStatePDA,
          subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
          walletTokenAccount: walletTokenAccount,
          merchantTokenAccount: merchantTokenAccount,
          walletYieldVault: yieldVault.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const subscriptionAccount = await program.account.subscriptionState.fetch(
        subscriptionStatePDA
      );

      assert.equal(subscriptionAccount.paymentCount, 1);
      assert.equal(
        subscriptionAccount.totalPaid.toString(),
        FEE_AMOUNT.toString()
      );

      const merchantBalanceAfter = await provider.connection.getTokenAccountBalance(
        merchantTokenAccount
      );

      const balanceIncrease = new BN(merchantBalanceAfter.value.amount).sub(
        new BN(merchantBalanceBefore.value.amount)
      );

      assert.equal(balanceIncrease.toString(), FEE_AMOUNT.toString());

      // Check wallet total spent increased
      const walletAccount = await program.account.subscriptionWallet.fetch(
        subscriptionWalletPDA
      );
      assert.equal(
        walletAccount.totalSpent.toString(),
        FEE_AMOUNT.toString()
      );
    });

    it("Cancels subscription", async () => {
      await program.methods
        .cancelSubscriptionWallet()
        .accounts({
          subscriptionState: subscriptionStatePDA,
          subscriptionWallet: subscriptionWalletPDA,
          merchantPlan: merchantPlanPDA,
          user: user.publicKey,
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
            subscriptionWallet: subscriptionWalletPDA,
            owner: user.publicKey,
            userTokenAccount: userTokenAccount,
            walletTokenAccount: walletTokenAccount,
            yieldVaultAccount: yieldVault.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
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
          subscriptionWallet: poorUserWalletPDA,
          mainTokenAccount: walletTokenAccountKp.publicKey,
          user: poorUser.publicKey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([poorUser, walletTokenAccountKp])
        .rpc();

      // Deposit to wallet
      await program.methods
        .depositToWallet(new BN(1000000))
        .accounts({
          subscriptionWallet: poorUserWalletPDA,
          user: poorUser.publicKey,
          userTokenAccount: poorUserTokenAccountInfo.address,
          walletTokenAccount: walletTokenAccountKp.publicKey,
          yieldVaultAccount: anchor.web3.Keypair.generate().publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
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
            subscriptionState: poorUserSubPDA,
            subscriptionWallet: poorUserWalletPDA,
            merchantPlan: merchantPlanPDA,
            user: poorUser.publicKey,
            walletTokenAccount: walletTokenAccountKp.publicKey,
            walletYieldVault: anchor.web3.Keypair.generate().publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([poorUser])
          .rpc();
        
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        assert.include(error.toString(), "InsufficientWalletBalance");
      }
    });

    it("Fails to enable yield twice", async () => {
      const yieldVault = anchor.web3.Keypair.generate();

      try {
        await program.methods
          .enableYield({ kaminoLend: {} })
          .accounts({
            subscriptionWallet: subscriptionWalletPDA,
            owner: user.publicKey,
            yieldVault: yieldVault.publicKey,
          })
          .signers([user])
          .rpc();
        
        assert.fail("Should have failed with YieldAlreadyEnabled");
      } catch (error) {
        assert.include(error.toString(), "YieldAlreadyEnabled");
      }
    });
  });
});