const { 
    Connection, 
    PublicKey, 
    Transaction, 
    SystemProgram, 
    Keypair,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
  } = require("@solana/web3.js");
  const { 
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getOrCreateAssociatedTokenAccount
  } = require("@solana/spl-token");
  const User = require("../models/User");
  const { decryptPrivateKey, generateEncryptionKey } = require("../utils/encryption");
  require('dotenv').config();
  
  // Initialize Solana connection
  const getConnection = () => {
    return new Connection(
      process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );
  };
  
  // Send SOL tokens
  const transferSOL = async (req, res) => {
    const { walletAddress, toAddress, amount } = req.body;
    const userId = req.user.id;
    
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Find the wallet
      const wallet = user.wallets.find(w => 
        w.address === walletAddress && w.blockchain === "solana"
      );
      
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      // Decrypt private key
      const encryptionKey = await generateEncryptionKey(req.body.password, user.salt);
      const privateKeyString = decryptPrivateKey(wallet.privateKey, encryptionKey);
      const privateKeyUint8 = Uint8Array.from(privateKeyString.split(',').map(Number));
      
      // Create keypair from private key
      const fromKeypair = Keypair.fromSecretKey(privateKeyUint8);
      
      // Validate from address matches keypair
      if (fromKeypair.publicKey.toString() !== walletAddress) {
        return res.status(400).json({ message: "Invalid wallet key pair" });
      }
      
      // Connect to Solana
      const connection = getConnection();
      
      // Create recipient public key
      const toPublicKey = new PublicKey(toAddress);
      
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: amount * LAMPORTS_PER_SOL
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );
      
      // Get updated balance
      const newBalance = await connection.getBalance(fromKeypair.publicKey);
      const solBalance = newBalance / LAMPORTS_PER_SOL;
      
      res.status(200).json({
        message: "SOL transferred successfully",
        transactionSignature: signature,
        newBalance: solBalance.toString(),
        symbol: "SOL"
      });
    } catch (error) {
      res.status(500).json({ 
        message: "SOL transfer failed", 
        error: error.message,
        details: error.logs || error.code || "Unknown error"
      });
    }
  };
  
  // Send SPL tokens
  const transferSPLToken = async (req, res) => {
    const { walletAddress, tokenAddress, toAddress, amount } = req.body;
    const userId = req.user.id;
    
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Find the wallet
      const wallet = user.wallets.find(w => 
        w.address === walletAddress && w.blockchain === "solana"
      );
      
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      // Decrypt private key
      const encryptionKey = await generateEncryptionKey(req.body.password, user.salt);
      const privateKeyString = decryptPrivateKey(wallet.privateKey, encryptionKey);
      const privateKeyUint8 = Uint8Array.from(privateKeyString.split(',').map(Number));
      
      // Create keypair from private key
      const fromKeypair = Keypair.fromSecretKey(privateKeyUint8);
      
      // Connect to Solana
      const connection = getConnection();
      
      // Create token mint public key
      const mintPublicKey = new PublicKey(tokenAddress);
      
      // Create recipient public key
      const toPublicKey = new PublicKey(toAddress);
      
      // Get token accounts
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        mintPublicKey,
        fromKeypair.publicKey
      );
      
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        mintPublicKey,
        toPublicKey
      );
      
      // Create transfer instruction
      const transferIx = createTransferInstruction(
        fromTokenAccount.address,
        toTokenAccount.address,
        fromKeypair.publicKey,
        amount * Math.pow(10, fromTokenAccount.decimals || 9)
      );
      
      // Create transaction and add transfer instruction
      const transaction = new Transaction().add(transferIx);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );
      
      // Get updated token balance
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        fromKeypair.publicKey,
        { mint: mintPublicKey }
      );
      
      let balance = 0;
      let decimals = 9;
      let symbol = "Unknown";
      
      if (tokenAccounts.value.length > 0) {
        const accountInfo = tokenAccounts.value[0].account.data.parsed;
        balance = accountInfo.info.tokenAmount.uiAmount;
        decimals = accountInfo.info.tokenAmount.decimals;
        symbol = accountInfo.info.symbol || "Unknown";
      }
      
      res.status(200).json({
        message: `${symbol} tokens transferred successfully`,
        transactionSignature: signature,
        newBalance: balance.toString(),
        symbol,
        decimals
      });
    } catch (error) {
      res.status(500).json({ 
        message: "SPL token transfer failed", 
        error: error.message,
        details: error.logs || error.code || "Unknown error"
      });
    }
  };
  
  // Get Solana transactions history
  const getSolanaTransactions = async (req, res) => {
    const { address } = req.params;
    
    try {
      const connection = getConnection();
      const publicKey = new PublicKey(address);
      
      // Get transaction signatures
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit: 10 }
      );
      
      if (signatures.length === 0) {
        return res.status(200).json({
          address,
          transactions: [],
          message: "No transactions found"
        });
      }
      
      // Get transaction details
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await connection.getParsedTransaction(sig.signature);
          
          return {
            signature: sig.signature,
            timestamp: new Date(sig.blockTime * 1000).toISOString(),
            slot: sig.slot,
            fee: tx ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
            status: sig.confirmationStatus,
            memo: tx && tx.meta && tx.meta.logMessages ? 
                  tx.meta.logMessages.find(msg => msg.startsWith('Program log: Memo')) || null : null
          };
        })
      );
      
      res.status(200).json({
        address,
        transactions,
        totalTransactions: signatures.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching Solana transaction history", 
        error: error.message 
      });
    }
  };
  
  module.exports = {
    transferSOL,
    transferSPLToken,
    getSolanaTransactions
  };