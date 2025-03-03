const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const logger = require('../utils/logger');

/**
 * Solana Provider Service
 * Handles interactions with the Solana blockchain
 */
class SolanaProvider {
  /**
   * Initialize Solana provider with RPC URL
   * @param {String} rpcUrl - Solana RPC endpoint URL
   */
  constructor(rpcUrl) {
    try {
      this.connection = new web3.Connection(rpcUrl, 'confirmed');
      logger.info('Solana provider initialized');
    } catch (error) {
      logger.error(`Failed to initialize Solana provider: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new Solana wallet
   * @returns {Object} Keypair object with publicKey and secretKey
   */
  async createWallet() {
    try {
      const keypair = web3.Keypair.generate();
      logger.info(`New Solana wallet created: ${keypair.publicKey.toString()}`);
      return {
        publicKey: keypair.publicKey.toString(),
        secretKey: Buffer.from(keypair.secretKey).toString('hex')
      };
    } catch (error) {
      logger.error(`Error creating Solana wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Solana wallet balance
   * @param {String} address - Wallet public key
   * @returns {Number} Balance in lamports
   */
  async getBalance(address) {
    try {
      const publicKey = new web3.PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      logger.info(`Fetched balance for Solana wallet ${address}: ${balance} lamports`);
      return balance;
    } catch (error) {
      logger.error(`Error getting Solana balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer SOL between wallets
   * @param {String} fromAddress - Sender's public key
   * @param {String} privateKey - Sender's private key (hex string)
   * @param {String} toAddress - Recipient's public key
   * @param {Number} amount - Amount to transfer in SOL
   * @returns {Object} Transaction details
   */
  async transfer(fromAddress, privateKeyHex, toAddress, amount) {
    try {
      // Convert amount to lamports (1 SOL = 1,000,000,000 lamports)
      const lamports = amount * web3.LAMPORTS_PER_SOL;
      
      // Convert hex private key to Uint8Array
      const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
      const keypair = web3.Keypair.fromSecretKey(privateKeyBytes);
      
      // Ensure the provided address matches the keypair
      if (keypair.publicKey.toString() !== fromAddress) {
        throw new Error('Private key does not match sender address');
      }
      
      const fromPublicKey = keypair.publicKey;
      const toPublicKey = new web3.PublicKey(toAddress);
      
      // Create transaction
      const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: fromPublicKey,
          toPubkey: toPublicKey,
          lamports
        })
      );
      
      // Set recent blockhash
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = fromPublicKey;
      
      // Sign and send transaction
      const signedTransaction = await web3.sendAndConfirmTransaction(
        this.connection,
        transaction,
        [keypair]
      );
      
      logger.info(`SOL transfer successful: ${signedTransaction}`);
      
      return {
        signature: signedTransaction,
        from: fromAddress,
        to: toAddress,
        amount
      };
    } catch (error) {
      logger.error(`Error transferring SOL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction details
   * @param {String} txHash - Transaction signature/hash
   * @returns {Object} Transaction details
   */
  async getTransactionDetails(txHash) {
    try {
      const transaction = await this.connection.getTransaction(txHash);
      
      if (!transaction) {
        logger.warn(`Transaction not found: ${txHash}`);
        return null;
      }
      
      // Parse transaction details
      const { meta } = transaction;
      
      if (!meta) {
        logger.warn(`Transaction metadata not available for: ${txHash}`);
        return {
          hash: txHash,
          status: 'unknown',
          timestamp: new Date(transaction.blockTime * 1000)
        };
      }
      
      // Extract pre and post balances to determine sender and receiver
      const accountKeys = transaction.transaction.message.accountKeys;
      let from = accountKeys[0].toString();
      let to = accountKeys[1].toString();
      
      // Calculate amount from the balance changes
      const preBalances = meta.preBalances;
      const postBalances = meta.postBalances;
      const amount = (preBalances[0] - postBalances[0] - meta.fee) / web3.LAMPORTS_PER_SOL;
      
      logger.info(`Retrieved transaction details for: ${txHash}`);
      
      return {
        hash: txHash,
        from,
        to,
        amount,
        fee: meta.fee / web3.LAMPORTS_PER_SOL,
        status: meta.err ? 'failed' : 'confirmed',
        timestamp: new Date(transaction.blockTime * 1000)
      };
    } catch (error) {
      logger.error(`Error fetching transaction details: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get token information for a Solana SPL token
   * @param {String} tokenAddress - Token mint address
   * @returns {Object} Token information
   */
  async getTokenInfo(tokenAddress) {
    try {
      const tokenPublicKey = new web3.PublicKey(tokenAddress);
      const mintInfo = await splToken.getMint(this.connection, tokenPublicKey);
      
      if (!mintInfo) {
        logger.warn(`Token not found: ${tokenAddress}`);
        return null;
      }
      
      // Get token accounts to estimate total supply
      const tokenAccounts = await this.connection.getTokenLargestAccounts(tokenPublicKey);
      const totalSupply = mintInfo.supply / (10 ** mintInfo.decimals);
      
      logger.info(`Retrieved token info for: ${tokenAddress}`);
      
      return {
        address: tokenAddress,
        decimals: mintInfo.decimals,
        totalSupply,
        // Note: Solana SPL tokens don't have name and symbol in the mint info
        // These would need to be fetched from a token registry service
        name: 'Unknown', 
        symbol: 'Unknown'
      };
    } catch (error) {
      logger.error(`Error fetching token info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get token balance for a specific wallet
   * @param {String} walletAddress - Wallet public key
   * @param {String} tokenAddress - Token mint address
   * @returns {Number} Token balance
   */
  async getTokenBalance(walletAddress, tokenAddress) {
    try {
      const walletPublicKey = new web3.PublicKey(walletAddress);
      const tokenPublicKey = new web3.PublicKey(tokenAddress);
      
      // Find the token account for this wallet
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        walletPublicKey,
        { mint: tokenPublicKey }
      );
      
      if (tokenAccounts.value.length === 0) {
        logger.info(`No token account found for ${tokenAddress} in wallet ${walletAddress}`);
        return 0;
      }
      
      // Get the balance
      const accountInfo = await splToken.getAccount(
        this.connection,
        tokenAccounts.value[0].pubkey
      );
      
      const mintInfo = await splToken.getMint(this.connection, tokenPublicKey);
      const balance = Number(accountInfo.amount) / (10 ** mintInfo.decimals);
      
      logger.info(`Token balance for ${tokenAddress} in wallet ${walletAddress}: ${balance}`);
      
      return balance;
    } catch (error) {
      logger.error(`Error getting token balance: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  SolanaProvider
};