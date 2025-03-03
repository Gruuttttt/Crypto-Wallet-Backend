const User = require('../models/User');
const { ethers } = require('ethers');
const { PublicKey } = require('@solana/web3.js');

// Get all address book entries
const getAddressBook = async (req, res) => {
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
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
};

// Update address book entry
const updateAddressBookEntry = async (req, res) => {
  const { entryId, label, notes } = req.body;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find entry by ID
    const entryIndex = user.addressBook.findIndex(entry => entry._id.toString() === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({ message: "Address book entry not found" });
    }
    
    // Update fields
    if (label) user.addressBook[entryIndex].label = label;
    if (notes !== undefined) user.addressBook[entryIndex].notes = notes;
    
    await user.save();
    
    res.status(200).json({
      message: "Address book entry updated successfully",
      entry: user.addressBook[entryIndex]
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete address book entry
const deleteAddressBookEntry = async (req, res) => {
  const { entryId } = req.params;
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Find entry by ID
    const entryIndex = user.addressBook.findIndex(entry => entry._id.toString() === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({ message: "Address book entry not found" });
    }
    
    // Remove entry
    user.addressBook.splice(entryIndex, 1);
    await user.save();
    
    res.status(200).json({
      message: "Address book entry deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add batch address book entries
const addBatchAddressBookEntries = async (req, res) => {
  const { entries } = req.body;
  const userId = req.user.id;
  
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: "Invalid entries format" });
  }
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const validEntries = [];
    const invalidEntries = [];
    
    // Validate and process each entry
    for (const entry of entries) {
      const { label, address, blockchain, notes } = entry;
      
      // Validate required fields
      if (!label || !address || !blockchain) {
        invalidEntries.push({
          ...entry,
          reason: "Missing required fields"
        });
        continue;
      }
      
      // Validate blockchain
      if (!['ethereum', 'solana'].includes(blockchain.toLowerCase())) {
        invalidEntries.push({
          ...entry,
          reason: "Invalid blockchain"
        });
        continue;
      }
      
      // Validate address format
      let isValid = false;
      if (blockchain.toLowerCase() === "ethereum") {
        isValid = ethers.isAddress(address);
      } else if (blockchain.toLowerCase() === "solana") {
        try {
          new PublicKey(address);
          isValid = true;
        } catch (e) {
          isValid = false;
        }
      }
      
      if (!isValid) {
        invalidEntries.push({
          ...entry,
          reason: `Invalid ${blockchain} address format`
        });
        continue;
      }
      
      // Check for duplicates in existing address book
      const existingEntry = user.addressBook.find(e => 
        e.address === address && e.blockchain === blockchain
      );
      
      if (existingEntry) {
        invalidEntries.push({
          ...entry,
          reason: "Address already exists in address book"
        });
        continue;
      }
      
      // Check for duplicates in current batch
      const duplicateInBatch = validEntries.find(e => 
        e.address === address && e.blockchain === blockchain
      );
      
      if (duplicateInBatch) {
        invalidEntries.push({
          ...entry,
          reason: "Duplicate address in batch"
        });
        continue;
      }
      
      // Add valid entry
      validEntries.push({
        label,
        address,
        blockchain: blockchain.toLowerCase(),
        notes: notes || "",
        createdAt: new Date()
      });
    }
    
    // Add valid entries to address book
    if (validEntries.length > 0) {
      user.addressBook.push(...validEntries);
      await user.save();
    }
    
    res.status(200).json({
      message: "Batch processing completed",
      added: validEntries.length,
      failed: invalidEntries.length,
      invalidEntries: invalidEntries.length > 0 ? invalidEntries : undefined
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getAddressBook,
  updateAddressBookEntry,
  deleteAddressBookEntry,
  addBatchAddressBookEntries
};