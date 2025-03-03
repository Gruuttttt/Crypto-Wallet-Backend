const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  verifyToken,
  authLimiter,
  createAdditionalWallet,
  setDefaultWallet,
  getEthereumBalance,
  getSolanaBalance,
  getEthereumTransactions,
  transferERC20Token,
  addAddressBookEntry,
  signMessage,
  recoverWalletFromPhrase
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Authentication routes
router.post('/register', registerUser);
router.post('/login', authLimiter, loginUser);

// Protected routes
// Wallet management
router.post('/wallets', protect, createAdditionalWallet);
router.put('/wallets/default', protect, setDefaultWallet);

// Balance and transaction routes
router.get('/ethereum/balance/:address', protect, getEthereumBalance);
router.get('/solana/balance/:address', protect, getSolanaBalance);
router.get('/ethereum/transactions/:address', protect, getEthereumTransactions);

// Transfer functionality
router.post('/ethereum/transfer/token', protect, transferERC20Token);

// Address book routes
router.post('/addressbook', protect, addAddressBookEntry);
router.get('/addressbook', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({
      message: "Address book entries retrieved",
      addressBook: user.addressBook
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Wallet utility routes
router.post('/wallet/sign', protect, signMessage);
router.post('/wallet/recover', recoverWalletFromPhrase);

// Account validation route
router.get('/account', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -salt -recoveryPhrase');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Get default wallets
    const defaultEthWallet = user.wallets.find(w => w.blockchain === "ethereum" && w.isDefault);
    const defaultSolWallet = user.wallets.find(w => w.blockchain === "solana" && w.isDefault);
    
    // Format response
    const wallets = user.wallets.map(w => ({
      blockchain: w.blockchain,
      address: w.address,
      label: w.label,
      isDefault: w.isDefault,
      createdAt: w.createdAt
    }));
    
    res.status(200).json({
      username: user.username,
      wallets,
      addressBookCount: user.addressBook.length,
      defaultAddresses: {
        ethereum: defaultEthWallet?.address || null,
        solana: defaultSolWallet?.address || null
      },
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;