import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SubscriptionProtocol } from "../target/types/subscription_protocol";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SubscriptionProtocol as Program<SubscriptionProtocol>;
  
  const protocolFeeBps = 50; // 0.5%
  const treasury = provider.wallet.publicKey;

  const [protocolConfig] = anchor.web3.PublicKeyFinder.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    program.programId
  );

  const tx = await program.methods
    .initializeProtocol(protocolFeeBps)
    .accounts({
      protocolConfig,
      authority: provider.wallet.publicKey,
      treasury,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Protocol initialized:", tx);
  console.log("Protocol Config PDA:", protocolConfig.toString());
  console.log("Fee:", protocolFeeBps / 100, "%");
}

main();