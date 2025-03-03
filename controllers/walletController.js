const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const ethers = require('ethers');
const { Connection, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// JWT Secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// User authentication methods
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password // Assuming your User model hashes the password before saving
    });

    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password - assuming your User model has a method to compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Wallet management methods
exports.createEthereumWallet = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    // Generate a new Ethereum wallet
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    // Encrypt private key before storing - in production use better encryption
    const encryptedPrivateKey = crypto.createHash('sha256')
      .update(privateKey + JWT_SECRET)
      .digest('hex');

    // Save wallet to database
    const newWallet = new Wallet({
      user: userId,
      name: name || 'Ethereum Wallet',
      blockchain: 'ethereum',
      address,
      privateKey: encryptedPrivateKey
    });

    await newWallet.save();

    res.status(201).json({
      message: 'Ethereum wallet created successfully',
      wallet: {
        id: newWallet._id,
        name: newWallet.name,
        blockchain: newWallet.blockchain,
        address: newWallet.address
      }
    });
  } catch (error) {
    console.error('Create Ethereum wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.importEthereumWallet = async (req, res) => {
  try {
    const { name, privateKey } = req.body;
    const userId = req.user.userId;

    if (!privateKey) {
      return res.status(400).json({ message: 'Private key is required' });
    }

    // Validate private key
    let wallet;
    try {
      wallet = new ethers.Wallet(privateKey);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid private key' });
    }

    const address = wallet.address;

    // Check if wallet already exists for this user
    const existingWallet = await Wallet.findOne({ user: userId, address });
    if (existingWallet) {
      return res.status(400).json({ message: 'Wallet already imported' });
    }

    // Encrypt private key before storing
    const encryptedPrivateKey = crypto.createHash('sha256')
      .update(privateKey + JWT_SECRET)
      .digest('hex');

    // Save wallet to database
    const newWallet = new Wallet({
      user: userId,
      name: name || 'Imported Ethereum Wallet',
      blockchain: 'ethereum',
      address,
      privateKey: encryptedPrivateKey
    });

    await newWallet.save();

    res.status(201).json({
      message: 'Ethereum wallet imported successfully',
      wallet: {
        id: newWallet._id,
        name: newWallet.name,
        blockchain: newWallet.blockchain,
        address: newWallet.address
      }
    });
  } catch (error) {
    console.error('Import Ethereum wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createSolanaWallet = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    // Generate a new Solana keypair
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);

    // Encrypt private key before storing
    const encryptedPrivateKey = crypto.createHash('sha256')
      .update(privateKey + JWT_SECRET)
      .digest('hex');

    // Save wallet to database
    const newWallet = new Wallet({
      user: userId,
      name: name || 'Solana Wallet',
      blockchain: 'solana',
      address,
      privateKey: encryptedPrivateKey
    });

    await newWallet.save();

    res.status(201).json({
      message: 'Solana wallet created successfully',
      wallet: {
        id: newWallet._id,
        name: newWallet.name,
        blockchain: newWallet.blockchain,
        address: newWallet.address
      }
    });
  } catch (error) {
    console.error('Create Solana wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.importSolanaWallet = async (req, res) => {
  try {
    const { name, privateKey } = req.body;
    const userId = req.user.userId;

    if (!privateKey) {
      return res.status(400).json({ message: 'Private key is required' });
    }

    // Validate private key and get public key
    let publicKey;
    try {
      const secretKey = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      publicKey = keypair.publicKey.toString();
    } catch (error) {
      return res.status(400).json({ message: 'Invalid private key' });
    }

    // Check if wallet already exists for this user
    const existingWallet = await Wallet.findOne({ user: userId, address: publicKey });
    if (existingWallet) {
      return res.status(400).json({ message: 'Wallet already imported' });
    }

    // Encrypt private key before storing
    const encryptedPrivateKey = crypto.createHash('sha256')
      .update(privateKey + JWT_SECRET)
      .digest('hex');

    // Save wallet to database
    const newWallet = new Wallet({
      user: userId,
      name: name || 'Imported Solana Wallet',
      blockchain: 'solana',
      address: publicKey,
      privateKey: encryptedPrivateKey
    });

    await newWallet.save();

    res.status(201).json({
      message: 'Solana wallet imported successfully',
      wallet: {
        id: newWallet._id,
        name: newWallet.name,
        blockchain: newWallet.blockchain,
        address: newWallet.address
      }
    });
  } catch (error) {
    console.error('Import Solana wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllWallets = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find all wallets for this user
    const wallets = await Wallet.find({ user: userId }).select('-privateKey');
    
    res.json(wallets);
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { name } = req.body;
    const userId = req.user.userId;

    // Find wallet and ensure it belongs to the current user
    const wallet = await Wallet.findOne({ _id: walletId, user: userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Update wallet name
    wallet.name = name || wallet.name;
    await wallet.save();

    res.json({
      message: 'Wallet updated successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        blockchain: wallet.blockchain,
        address: wallet.address
      }
    });
  } catch (error) {
    console.error('Update wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const userId = req.user.userId;

    // Find wallet and ensure it belongs to the current user
    const wallet = await Wallet.findOne({ _id: walletId, user: userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Delete wallet
    await Wallet.deleteOne({ _id: walletId });

    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error('Delete wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};