const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'My Wallet'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const addressBookEntrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  network: {
    type: String,
    enum: ['ethereum', 'solana'],
    required: true
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  wallets: {
    ethereum: [walletSchema],
    solana: [walletSchema]
  },
  addressBook: [addressBookEntrySchema],
  preferences: {
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'CNY'],
      default: 'USD'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      transactions: {
        type: Boolean,
        default: true
      },
      priceAlerts: {
        type: Boolean,
        default: false
      }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;