const Web3Connection = require('../services/web3');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Controller for handling Ethereum blockchain operations
 */
class EthereumController {
  constructor() {
    this.connection = new Web3Connection();
  }

  /**
   * Create a new Ethereum wallet
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Wallet details
   */
  async createWallet(req, res) {
    try {
      logger.info('Creating new Ethereum wallet');
      const web3 = this.connection.getWeb3();
      const account = web3.eth.accounts.create();
      
      return res.status(201).json({
        success: true,
        data: {
          address: account.address,
          privateKey: account.privateKey,
          network: 'ethereum',
          balance: 0
        }
      });
    } catch (error) {
      logger.error(`Error creating Ethereum wallet: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Ethereum wallet'
      });
    }
  }

  /**
   * Get Ethereum wallet balance
   * @param {Object} req - Request object with address param
   * @param {Object} res - Response object
   * @returns {Object} Wallet balance
   */
  async getBalance(req, res) {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required'
        });
      }

      logger.info(`Fetching balance for Ethereum wallet: ${address}`);
      const web3 = this.connection.getWeb3();
      const balance = await web3.eth.getBalance(address);
      
      return res.status(200).json({
        success: true,
        data: {
          address,
          balance,
          network: 'ethereum'
        }
      });
    } catch (error) {
      logger.error(`Error fetching Ethereum wallet balance: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet balance'
      });
    }
  }

  /**
   * Transfer ETH between wallets
   * @param {Object} req - Request object with fromAddress, privateKey, toAddress, amount
   * @param {Object} res - Response object
   * @returns {Object} Transaction details
   */
  async transferFunds(req, res) {
    try {
      const { fromAddress, privateKey, toAddress, amount } = req.body;
      
      if (!fromAddress || !privateKey || !toAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fromAddress, privateKey, toAddress, amount'
        });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        });
      }

      logger.info(`Initiating Ethereum transfer from ${fromAddress} to ${toAddress}`);
      const web3 = this.connection.getWeb3();
      
      // Get the current gas price
      const gasPrice = await web3.eth.getGasPrice();
      const gasLimit = config.ethereum.gasLimit || 21000;
      
      // Convert amount to wei
      const amountWei = web3.utils.toWei(amount.toString(), 'ether');
      
      // Create and sign transaction
      const tx = {
        from: fromAddress,
        to: toAddress,
        value: amountWei,
        gas: gasLimit,
        gasPrice
      };
      
      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return res.status(200).json({
        success: true,
        data: {
          transactionHash: receipt.transactionHash,
          fromAddress,
          toAddress,
          amount: parseFloat(amount),
          network: 'ethereum',
          gasUsed: receipt.gasUsed,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error(`Error transferring ETH: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to transfer funds'
      });
    }
  }

  /**
   * Get transaction details
   * @param {Object} req - Request object with txHash param
   * @param {Object} res - Response object
   * @returns {Object} Transaction details
   */
  async getTransaction(req, res) {
    try {
      const { txHash } = req.params;
      
      if (!txHash) {
        return res.status(400).json({
          success: false,
          error: 'Transaction hash is required'
        });
      }

      logger.info(`Fetching Ethereum transaction details for hash: ${txHash}`);
      const web3 = this.connection.getWeb3();
      const transaction = await web3.eth.getTransaction(txHash);
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          hash: txHash,
          from: transaction.from,
          to: transaction.to,
          amount: web3.utils.fromWei(transaction.value, 'ether'),
          gas: transaction.gas,
          gasPrice: web3.utils.fromWei(transaction.gasPrice, 'gwei'),
          gasUsed: receipt ? receipt.gasUsed : null,
          status: receipt ? (receipt.status ? 'confirmed' : 'failed') : 'pending',
          blockNumber: transaction.blockNumber,
          timestamp: transaction.blockNumber ? new Date() : null, // In a real app, get timestamp from block
          network: 'ethereum'
        }
      });
    } catch (error) {
      logger.error(`Error fetching Ethereum transaction: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction details'
      });
    }
  }

  /**
   * Get token information for an ERC20 token
   * @param {Object} req - Request object with tokenAddress param
   * @param {Object} res - Response object
   * @returns {Object} Token information
   */
  async getTokenInfo(req, res) {
    try {
      const { tokenAddress } = req.params;
      
      if (!tokenAddress) {
        return res.status(400).json({
          success: false,
          error: 'Token address is required'
        });
      }

      logger.info(`Fetching Ethereum token info for address: ${tokenAddress}`);
      const web3 = this.connection.getWeb3();
      
      // Minimal ABI for ERC20 token
      const minABI = [
        {
          constant: true,
          inputs: [],
          name: "name",
          outputs: [{ name: "", type: "string" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "symbol",
          outputs: [{ name: "", type: "string" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "decimals",
          outputs: [{ name: "", type: "uint8" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "totalSupply",
          outputs: [{ name: "", type: "uint256" }],
          type: "function",
        }
      ];
      
      const contract = new web3.eth.Contract(minABI, tokenAddress);
      
      // Use Promise.all to get all token info in parallel
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.methods.name().call().catch(() => "Unknown"),
        contract.methods.symbol().call().catch(() => "Unknown"),
        contract.methods.decimals().call().catch(() => "18"),
        contract.methods.totalSupply().call().catch(() => "0")
      ]);
      
      // Calculate total supply with decimals
      const formattedTotalSupply = totalSupply / (10 ** decimals);
      
      return res.status(200).json({
        success: true,
        data: {
          address: tokenAddress,
          name,
          symbol,
          decimals: parseInt(decimals),
          totalSupply: formattedTotalSupply,
          network: 'ethereum'
        }
      });
    } catch (error) {
      logger.error(`Error fetching Ethereum token info: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch token information'
      });
    }
  }
}

module.exports = new EthereumController();