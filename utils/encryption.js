const crypto = require('crypto');

/**
 * Encrypt a private key or sensitive data
 * @param {string} privateKey - The private key or sensitive data to encrypt
 * @param {string} encryptionKey - The key used for encryption (hex string)
 * @returns {string} The encrypted data in format: iv:encryptedData
 */
const encryptPrivateKey = (privateKey, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt an encrypted private key or sensitive data
 * @param {string} encryptedData - The encrypted data in format: iv:encryptedData
 * @param {string} encryptionKey - The key used for decryption (hex string)
 * @returns {string} The decrypted private key or sensitive data
 */
const decryptPrivateKey = (encryptedData, encryptionKey) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Generate a deterministic encryption key from user password and salt
 * @param {string} password - User password
 * @param {string} salt - Unique salt for the user
 * @returns {Promise<string>} The generated encryption key as hex string
 */
const generateEncryptionKey = async (password, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha512', (err, key) => {
      if (err) reject(err);
      resolve(key.toString('hex'));
    });
  });
};

/**
 * Generate a random encryption key
 * @param {number} length - Length of the key in bytes (default: 32)
 * @returns {string} Random encryption key as hex string
 */
const generateRandomKey = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Create a one-way hash of data (for non-reversible hashing)
 * @param {string} data - Data to hash
 * @param {string} salt - Salt to use in hashing
 * @returns {string} Hash as hex string
 */
const hashData = (data, salt) => {
  return crypto
    .createHash('sha256')
    .update(data + salt)
    .digest('hex');
};

module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
  generateEncryptionKey,
  generateRandomKey,
  hashData
};