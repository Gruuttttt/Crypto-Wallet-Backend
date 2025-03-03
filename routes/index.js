const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Import controllers
const walletController = require('../controllers/walletController');
const ethereumController = require('../controllers/ethereumController');
const solanaController = require('../controllers/solanaController');
const addressBookController = require('../controllers/addressBookController');

// Auth routes
router.post('/auth/register', walletController.register);
router.post('/auth/login', walletController.login);
router.get('/auth/me', auth, walletController.getCurrentUser);

// Wallet management routes
router.post('/wallets/ethereum/create', auth, walletController.createEthereumWallet);
router.post('/wallets/ethereum/import', auth, walletController.importEthereumWallet);
router.post('/wallets/solana/create', auth, walletController.createSolanaWallet);
router.post('/wallets/solana/import', auth, walletController.importSolanaWallet);
router.get('/wallets', auth, walletController.getAllWallets);
router.put('/wallets/:walletId', auth, walletController.updateWallet);
router.delete('/wallets/:walletId', auth, walletController.deleteWallet);

// Ethereum routes
// Make sure these methods exist in the ethereumController
router.post('/ethereum/transfer', auth, ethereumController.transferETH || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.post('/ethereum/token/transfer', auth, ethereumController.transferERC20 || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/ethereum/balance/:address', ethereumController.getETHBalance || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/ethereum/token/balance/:address/:tokenAddress', ethereumController.getTokenBalance || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/ethereum/transactions/:address', ethereumController.getTransactionHistory || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/ethereum/gas-price', ethereumController.getGasPrice || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.post('/ethereum/estimate-gas', ethereumController.estimateGas || ((req, res) => res.status(501).json({ error: 'Not implemented' })));

// Solana routes
router.post('/solana/transfer', auth, solanaController.transferSOL || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.post('/solana/token/transfer', auth, solanaController.transferSPLToken || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/solana/balance/:address', solanaController.getSOLBalance || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/solana/token/balance/:address/:tokenAddress', solanaController.getTokenBalance || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.get('/solana/transactions/:address', solanaController.getTransactionHistory || ((req, res) => res.status(501).json({ error: 'Not implemented' })));

// Address book routes
router.get('/address-book', auth, addressBookController.getAddressBook || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.post('/address-book', auth, addressBookController.addAddressBookEntry || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.put('/address-book/:entryId', auth, addressBookController.updateAddressBookEntry || ((req, res) => res.status(501).json({ error: 'Not implemented' })));
router.delete('/address-book/:entryId', auth, addressBookController.deleteAddressBookEntry || ((req, res) => res.status(501).json({ error: 'Not implemented' })));

module.exports = router;