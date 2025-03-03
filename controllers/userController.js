const { ethers } = require("ethers");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
require('dotenv').config();
const { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedAccountData
} = require("@solana/web3.js");
const { 
  TOKEN_PROGRAM_ID,
  createTransferInstruction
} = require("@solana/spl-token");

// Standard ERC-20 ABI for token interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Encryption/decryption helpers for private keys
const encryptPrivateKey = (privateKey, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decryptPrivateKey = (encryptedData, encryptionKey) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Generate a deterministic encryption key from user password and salt
const generateEncryptionKey = async (password, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha512', (err, key) => {
      if (err) reject(err);
      resolve(key.toString('hex'));
    });
  });
};

// Create rate limiter middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: { message: "Too many failed login attempts, please try again later" }
});

// User Authentication Controllers with enhanced security
const registerUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "Username already exists" });

    // Create salt for both password hashing and encryption key generation
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate encryption key for private keys
    const encryptionKey = await generateEncryptionKey(password, salt);
    
    // Generate mnemonic for recovery
    const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
    
    // Create Ethereum wallet from mnemonic
    const ethWallet = ethers.Wallet.fromPhrase(mnemonic);
    const encryptedEthPrivateKey = encryptPrivateKey(ethWallet.privateKey, encryptionKey);
    
    // Create Solana wallet
    const solWallet = Keypair.generate();
    const encryptedSolPrivateKey = encryptPrivateKey(
      Buffer.from(solWallet.secretKey).toString(), 
      encryptionKey
    );

    const newUser = new User({
      username,
      password: hashedPassword,
      salt,
      recoveryPhrase: encryptPrivateKey(mnemonic, encryptionKey),
      wallets: [
        {
          blockchain: "ethereum",
          address: ethWallet.address,
          privateKey: encryptedEthPrivateKey,
          isDefault: true,
          label: "Default ETH Wallet"
        },
        {
          blockchain: "solana",
          address: solWallet.publicKey.toString(),
          privateKey: encryptedSolPrivateKey,
          isDefault: true,
          label: "Default SOL Wallet"
        }
      ],
      addressBook: []
    });
    
    await newUser.save();

    res.status(201).json({ 
      message: "User registered successfully",
      mnemonic, // Only show once during registration
      addresses: {
        ethereum: ethWallet.address,
        solana: solWallet.publicKey.toString()
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token for authenticated requests
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Get default wallets
    const defaultEthWallet = user.wallets.find(w => w.blockchain === "ethereum" && w.isDefault);
    const defaultSolWallet = user.wallets.find(w => w.blockchain === "solana" && w.isDefault);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        username: user.username,
        defaultAddresses: {
          ethereum: defaultEthWallet?.address || null,
          solana: defaultSolWallet?.address || null
        },
        walletCount: user.wallets.length,
        addressBookCount: user.addressBook.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Wallet Management
const createAdditionalWallet = async (req, res) => {
  const { blockchain, label } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Generate encryption key
    const encryptionKey = await generateEncryptionKey(req.body.password, user.salt);
    
    let newWallet;
    if (blockchain.toLowerCase() === "ethereum") {
      const wallet = ethers.Wallet.createRandom();
      newWallet = {
        blockchain: "ethereum",
        address: wallet.address,
        privateKey: encryptPrivateKey(wallet.privateKey, encryptionKey),
        isDefault: false,
        label: label || `ETH Wallet ${user.wallets.filter(w => w.blockchain === "ethereum").length + 1}`,
        createdAt: new Date()
      };
    } else if (blockchain.toLowerCase() === "solana") {
      const wallet = Keypair.generate();
      newWallet = {
        blockchain: "solana",
        address: wallet.publicKey.toString(),
        privateKey: encryptPrivateKey(Buffer.from(wallet.secretKey).toString(), encryptionKey),
        isDefault: false,
        label: label || `SOL Wallet ${user.wallets.filter(w => w.blockchain === "solana").length + 1}`,
        createdAt: new Date()
      };
    } else {
      return res.status(400).json({ message: "Unsupported blockchain" });
    }
    
    user.wallets.push(newWallet);
    await user.save();
    
    res.status(201).json({
      message: "Wallet created successfully",
      wallet: {
        blockchain: newWallet.blockchain,
        address: newWallet.address,
        label: newWallet.label
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const setDefaultWallet = async (req, res) => {
  const { walletAddress, blockchain } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find the wallet and set as default
    const walletIndex = user.wallets.findIndex(w => 
      w.address === walletAddress && w.blockchain === blockchain
    );
    
    if (walletIndex === -1) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    
    // Remove default status from other wallets of same blockchain
    user.wallets.forEach((wallet, index) => {
      if (wallet.blockchain === blockchain) {
        user.wallets[index].isDefault = false;
      }
    });
    
    // Set new default
    user.wallets[walletIndex].isDefault = true;
    await user.save();
    
    res.status(200).json({
      message: "Default wallet updated successfully",
      defaultWallet: {
        blockchain,
        address: walletAddress,
        label: user.wallets[walletIndex].label
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Balance checking endpoints
const getEthereumBalance = async (req, res) => {
  const { address } = req.params;
  const { tokenAddress } = req.query;
  
  try {
    const cleanUrl = process.env.VITE_ALCHEMY_ETH_URL.replace('https://https://', 'https://');
    const provider = new ethers.JsonRpcProvider(cleanUrl);
    
    let balance, symbol, decimals;
    
    if (tokenAddress) {
      // ERC-20 token balance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      balance = await tokenContract.balanceOf(address);
      symbol = await tokenContract.symbol();
      decimals = await tokenContract.decimals();
      
      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      res.status(200).json({
        address,
        tokenAddress,
        balance: formattedBalance,
        symbol,
        decimals
      });
    } else {
      // Native ETH balance
      balance = await provider.getBalance(address);
      const formattedBalance = ethers.formatEther(balance);
      
      res.status(200).json({
        address,
        balance: formattedBalance,
        symbol: "ETH",
        network: (await provider.getNetwork()).name
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching balance", error: error.message });
  }
};

const getSolanaBalance = async (req, res) => {
  const { address } = req.params;
  const { tokenAddress } = req.query;
  
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
    const publicKey = new PublicKey(address);
    
    if (tokenAddress) {
      // SPL token balance
      const tokenPublicKey = new PublicKey(tokenAddress);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: tokenPublicKey });
      
      if (tokenAccounts.value.length === 0) {
        return res.status(200).json({
          address,
          tokenAddress,
          balance: "0",
          symbol: "Unknown",
          decimals: 0
        });
      }
      
      const accountInfo = tokenAccounts.value[0].account.data.parsed;
      const balance = accountInfo.info.tokenAmount.uiAmount;
      
      res.status(200).json({
        address,
        tokenAddress,
        balance: balance.toString(),
        symbol: accountInfo.info.symbol || "Unknown",
        decimals: accountInfo.info.tokenAmount.decimals
      });
    } else {
      // Native SOL balance
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      res.status(200).json({
        address,
        balance: solBalance.toString(),
        symbol: "SOL",
        network: process.env.SOLANA_NETWORK || "devnet"
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching Solana balance", error: error.message });
  }
};

// Transaction history
const getEthereumTransactions = async (req, res) => {
  const { address } = req.params;
  
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    const network = process.env.ETH_NETWORK || "mainnet";
    let baseUrl;
    
    switch (network) {
      case "mainnet":
        baseUrl = "https://api.etherscan.io/api";
        break;
      case "goerli":
        baseUrl = "https://api-goerli.etherscan.io/api";
        break;
      default:
        baseUrl = "https://api.etherscan.io/api";
    }
    
    const url = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "1") {
      const transactions = data.result.slice(0, 10).map(tx => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        gasUsed: tx.gasUsed,
        isError: tx.isError === "1"
      }));
      
      res.status(200).json({
        address,
        transactions,
        totalTransactions: data.result.length
      });
    } else {
      res.status(200).json({
        address,
        transactions: [],
        message: data.message
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching transaction history", error: error.message });
  }
};

// Token transfer functionality
const transferERC20Token = async (req, res) => {
  const { walletAddress, tokenAddress, toAddress, amount } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find the wallet
    const wallet = user.wallets.find(w => 
      w.address === walletAddress && w.blockchain === "ethereum"
    );
    
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    
    // Decrypt private key
    const encryptionKey = await generateEncryptionKey(req.body.password, user.salt);
    const privateKey = decryptPrivateKey(wallet.privateKey, encryptionKey);
    
    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(
      process.env.VITE_ALCHEMY_ETH_URL.replace('https://https://', 'https://')
    );
    const signer = new ethers.Wallet(privateKey, provider);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    // Get token details
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    
    // Estimate gas
    const amountInWei = ethers.parseUnits(amount.toString(), decimals);
    const gasEstimate = await tokenContract.transfer.estimateGas(toAddress, amountInWei);
    
    // Send transaction
    const tx = await tokenContract.transfer(toAddress, amountInWei, {
      gasLimit: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Get updated balance
    const newBalance = await tokenContract.balanceOf(walletAddress);
    const formattedBalance = ethers.formatUnits(newBalance, decimals);
    
    res.status(200).json({
      message: `${symbol} tokens transferred successfully`,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      newBalance: formattedBalance,
      symbol
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Token transfer failed", 
      error: error.message,
      details: {
        code: error.code,
        reason: error.reason
      }
    });
  }
};

// Address book functionality
const addAddressBookEntry = async (req, res) => {
  const { label, address, blockchain, notes } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Validate address format based on blockchain
    let isValid = false;
    if (blockchain === "ethereum") {
      isValid = ethers.isAddress(address);
    } else if (blockchain === "solana") {
      try {
        new PublicKey(address);
        isValid = true;
      } catch (e) {
        isValid = false;
      }
    }
    
    if (!isValid) {
      return res.status(400).json({ message: `Invalid ${blockchain} address format` });
    }
    
    // Check for duplicates
    const existingEntry = user.addressBook.find(entry => 
      entry.address === address && entry.blockchain === blockchain
    );
    
    if (existingEntry) {
      return res.status(400).json({ message: "Address already exists in address book" });
    }
    
    // Add new entry
    user.addressBook.push({
      label,
      address,
      blockchain,
      notes: notes || "",
      createdAt: new Date()
    });
    
    await user.save();
    
    res.status(201).json({
      message: "Address added to address book",
      entry: {
        label,
        address,
        blockchain,
        notes: notes || ""
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Message signing functionality
const signMessage = async (req, res) => {
  const { walletAddress, blockchain, message } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find the wallet
    const wallet = user.wallets.find(w => 
      w.address === walletAddress && w.blockchain === blockchain
    );
    
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    
    // Decrypt private key
    const encryptionKey = await generateEncryptionKey(req.body.password, user.salt);
    const privateKey = decryptPrivateKey(wallet.privateKey, encryptionKey);
    
    let signature;
    if (blockchain === "ethereum") {
      const signer = new ethers.Wallet(privateKey);
      signature = await signer.signMessage(message);
    } else if (blockchain === "solana") {
      const keypair = Keypair.fromSecretKey(
        Uint8Array.from(privateKey.split(",").map(Number))
      );
      const messageBytes = Buffer.from(message);
      const signatureBytes = nacl.sign.detached(
        messageBytes,
        keypair.secretKey
      );
      signature = Buffer.from(signatureBytes).toString("base64");
    } else {
      return res.status(400).json({ message: "Unsupported blockchain for signing" });
    }
    
    res.status(200).json({
      message: "Message signed successfully",
      signature,
      originalMessage: message
    });
  } catch (error) {
    res.status(500).json({ message: "Signing failed", error: error.message });
  }
};

// Wallet recovery functionality
const recoverWalletFromPhrase = async (req, res) => {
  const { username, password, newPassword } = req.body;
  
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Generate encryption key
    const encryptionKey = await generateEncryptionKey(password, user.salt);
    
    // Decrypt recovery phrase
    const mnemonic = decryptPrivateKey(user.recoveryPhrase, encryptionKey);
    
    // If a new password is provided, update it
    if (newPassword) {
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHashedPassword = await bcrypt.hash(newPassword, 10);
      const newEncryptionKey = await generateEncryptionKey(newPassword, newSalt);
      
      // Re-encrypt mnemonic with new key
      const newEncryptedMnemonic = encryptPrivateKey(mnemonic, newEncryptionKey);
      
      // Re-encrypt all wallet private keys
      const updatedWallets = await Promise.all(user.wallets.map(async wallet => {
        const decryptedKey = decryptPrivateKey(wallet.privateKey, encryptionKey);
        const reEncryptedKey = encryptPrivateKey(decryptedKey, newEncryptionKey);
        return {
          ...wallet._doc,
          privateKey: reEncryptedKey
        };
      }));
      
      // Update user
      user.password = newHashedPassword;
      user.salt = newSalt;
      user.recoveryPhrase = newEncryptedMnemonic;
      user.wallets = updatedWallets;
      await user.save();
      
      return res.status(200).json({
        message: "Wallet recovered and password updated successfully",
        recoveryPhrase: mnemonic // Only show during recovery
      });
    }
    
    res.status(200).json({
      message: "Recovery phrase retrieved successfully",
      recoveryPhrase: mnemonic
    });
  } catch (error) {
    res.status(500).json({ message: "Recovery failed", error: error.message });
  }
};

module.exports = {
  // Auth
  registerUser,
  loginUser,
  verifyToken,
  authLimiter,
  
  // Wallet management
  createAdditionalWallet,
  setDefaultWallet,
  
  // Balance and transactions
  getEthereumBalance,
  getSolanaBalance,
  getEthereumTransactions,
  
  // Transactions
  // signAndSendEthTransaction,
  // signAndSendSolTransaction,
  transferERC20Token,
  
  // Address book
  addAddressBookEntry,
  
  // Security and tools
  signMessage,
  recoverWalletFromPhrase,
  // ejectUser
};