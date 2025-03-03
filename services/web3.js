const { Web3 } = require('web3'); // Change to destructured import
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Web3 Connection Service
 * Handles connections to various blockchain networks using Web3
 */
class Web3Connection {
  constructor() {
    this.providers = {};
    this.web3Instances = {};
    
    // Initialize Ethereum connection by default
    this.initEthereumConnection();
  }

  /**
   * Initialize Ethereum connection
   */
  initEthereumConnection() {
    try {
      this.web3Instances.ethereum = new Web3(config.ethereum.rpcUrl);
      logger.info('Ethereum Web3 connection initialized');
    } catch (error) {
      logger.error(`Failed to initialize Ethereum connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Web3 instance for a specific network
   * @param {String} network - Blockchain network name
   * @returns {Object} Web3 instance
   */
  getWeb3(network = 'ethereum') {
    if (!this.web3Instances[network]) {
      if (network === 'ethereum') {
        this.initEthereumConnection();
      } else {
        throw new Error(`Web3 connection for ${network} not initialized`);
      }
    }
    return this.web3Instances[network];
  }

  /**
   * Check connection status
   * @param {String} network - Blockchain network name
   * @returns {Boolean} Connection status
   */
  async isConnected(network = 'ethereum') {
    try {
      const web3 = this.getWeb3(network);
      return await web3.eth.net.isListening();
    } catch (error) {
      logger.error(`Error checking connection status: ${error.message}`);
      return false;
    }
  }

  /**
   * Get network ID
   * @param {String} network - Blockchain network name
   * @returns {Number} Network ID
   */
  async getNetworkId(network = 'ethereum') {
    try {
      const web3 = this.getWeb3(network);
      return await web3.eth.net.getId();
    } catch (error) {
      logger.error(`Error getting network ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get gas price
   * @param {String} network - Blockchain network name
   * @returns {String} Gas price in wei
   */
  async getGasPrice(network = 'ethereum') {
    try {
      const web3 = this.getWeb3(network);
      return await web3.eth.getGasPrice();
    } catch (error) {
      logger.error(`Error getting gas price: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new account
   * @param {String} network - Blockchain network name
   * @returns {Object} Account object with address and privateKey
   */
  createAccount(network = 'ethereum') {
    try {
      const web3 = this.getWeb3(network);
      return web3.eth.accounts.create();
    } catch (error) {
      logger.error(`Error creating account: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account balance
   * @param {String} address - Account address
   * @param {String} network - Blockchain network name
   * @returns {String} Balance in wei
   */
  async getBalance(address, network = 'ethereum') {
    try {
      const web3 = this.getWeb3(network);
      return await web3.eth.getBalance(address);
    } catch (error) {
      logger.error(`Error getting balance: ${error.message}`);
      throw error;
    }
  }
}

// Fix the export to match how it's imported in other files
module.exports = Web3Connection;