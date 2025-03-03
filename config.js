/**
 * Application configuration
 * Loads environment variables and provides configuration for various services
 */

require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // MongoDB configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://harshwardhanlahane45:CvTs96yW0A2AT1nG@cluster0.gnypz.mongodb.net/Bonk-Pay?retryWrites=true&w=majority&appName=Cluster0',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // Ethereum configuration
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/ce4snl-r4_OcaYedFaDJO2sjTgzaiPY9',
    chainId: parseInt(process.env.ETHEREUM_CHAIN_ID, 10) || 1,
    gasLimit: parseInt(process.env.ETHEREUM_GAS_LIMIT, 10) || 21000,
    testnetRpcUrl: process.env.ETHEREUM_TESTNET_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/ce4snl-r4_OcaYedFaDJO2sjTgzaiPY9',
    testnetChainId: parseInt(process.env.ETHEREUM_TESTNET_CHAIN_ID, 10) || 5
  },
  
  // Solana configuration
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/ce4snl-r4_OcaYedFaDJO2sjTgzaiPY9',
    commitment: process.env.SOLANA_COMMITMENT || 'confirmed',
    testnetRpcUrl: process.env.SOLANA_TESTNET_RPC_URL || 'https://solana-devnet.g.alchemy.com/v2/ce4snl-r4_OcaYedFaDJO2sjTgzaiPY9'
  },

  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'a8f2e91b73c6d5g4h7j8k9l0m1n2o3p4q5r6s7t8u9v0w',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filepath: process.env.LOG_FILE_PATH || './logs'
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100 // limit each IP to 100 requests per windowMs
  }
};

module.exports = config;