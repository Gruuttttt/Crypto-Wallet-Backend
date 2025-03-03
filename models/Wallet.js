const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Wallet Schema
 * Stores wallet information for different blockchain networks
 */
const WalletSchema = new Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  network: {
    type: String,
    required: true,
    enum: ['ethereum', 'solana', 'bitcoin'],
    index: true
  },
  privateKey: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    default: ''
  },
  balance: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tokens: [{
    address: String,
    symbol: String,
    balance: Number,
    name: String,
    decimals: Number
  }],
  transactions: [{
    hash: String,
    type: {
      type: String,
      enum: ['send', 'receive']
    },
    amount: Number,
    timestamp: Date,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending'
    },
    to: String,
    from: String,
    fee: Number
  }]
}, { timestamps: true });

// Add indexes for common queries
WalletSchema.index({ userId: 1, network: 1 });
WalletSchema.index({ address: 1, network: 1 }, { unique: true });

// Methods

/**
 * Find wallet by address and network
 * @param {String} address - Wallet address
 * @param {String} network - Blockchain network
 * @returns {Promise} Wallet document
 */
WalletSchema.statics.findByAddressAndNetwork = function(address, network) {
  return this.findOne({ address, network });
};

/**
 * Find all wallets for a user
 * @param {String} userId - User ID
 * @returns {Promise} Array of wallet documents
 */
WalletSchema.statics.findAllForUser = function(userId) {
  return this.find({ userId, isActive: true });
};

/**
 * Update wallet balance
 * @param {String} address - Wallet address
 * @param {String} network - Blockchain network
 * @param {Number} balance - New balance
 * @returns {Promise} Updated wallet document
 */
WalletSchema.statics.updateBalance = function(address, network, balance) {
  return this.findOneAndUpdate(
    { address, network },
    { 
      balance,
      lastUpdated: Date.now()
    },
    { new: true }
  );
};

/**
 * Add transaction to wallet
 * @param {String} address - Wallet address
 * @param {String} network - Blockchain network
 * @param {Object} transaction - Transaction details
 * @returns {Promise} Updated wallet document
 */
WalletSchema.statics.addTransaction = function(address, network, transaction) {
  return this.findOneAndUpdate(
    { address, network },
    { 
      $push: { transactions: transaction },
      lastUpdated: Date.now()
    },
    { new: true }
  );
};

/**
 * Update token balance
 * @param {String} address - Wallet address
 * @param {String} network - Blockchain network
 * @param {String} tokenAddress - Token address
 * @param {Number} balance - New token balance
 * @returns {Promise} Updated wallet document
 */
WalletSchema.statics.updateTokenBalance = function(address, network, tokenAddress, balance, tokenInfo = {}) {
  const tokenData = {
    address: tokenAddress,
    balance,
    ...tokenInfo
  };

  return this.findOneAndUpdate(
    { 
      address, 
      network,
      'tokens.address': tokenAddress
    },
    { 
      $set: { 'tokens.$': tokenData },
      lastUpdated: Date.now()
    },
    { new: true }
  ).then(wallet => {
    if (wallet) return wallet;
    
    // Token doesn't exist yet, add it
    return this.findOneAndUpdate(
      { address, network },
      { 
        $push: { tokens: tokenData },
        lastUpdated: Date.now()
      },
      { new: true }
    );
  });
};

// Virtuals

// Create a virtual field for formattedBalance that accounts for decimals
WalletSchema.virtual('formattedBalance').get(function() {
  const decimals = this.network === 'ethereum' ? 18 : this.network === 'solana' ? 9 : 8;
  return this.balance / Math.pow(10, decimals);
});

// Pre-save middleware to ensure address is lowercase for Ethereum
WalletSchema.pre('save', function(next) {
  if (this.network === 'ethereum') {
    this.address = this.address.toLowerCase();
  }
  next();
});

// Create and export the model
const Wallet = mongoose.model('Wallet', WalletSchema);
module.exports = Wallet;