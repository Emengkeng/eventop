import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SubscriptionProtocol } from "../target/types/subscription_protocol";
import * as fs from "fs";
import * as os from "os";

async function main() {
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.SubscriptionProtocol as Program<SubscriptionProtocol>;

  const protocolFeeBps = 50; // 0.5%
  const treasury = provider.wallet.publicKey;

  const [protocolConfig] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    program.programId
  );

  const tx = await program.methods
    .initializeProtocol(protocolFeeBps)
    .accounts({
      // protocolConfig is a PDA - DO NOT include it
      authority: provider.wallet.publicKey,
      treasury,
      // systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Protocol initialized:", tx);
  console.log("Protocol Config PDA:", protocolConfig.toString());
  console.log("Fee:", protocolFeeBps / 100, "%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });