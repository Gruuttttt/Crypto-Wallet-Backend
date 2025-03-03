const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Generate JWT token for user authentication
 * @param {string} id - User ID
 * @param {string} username - Username
 * @param {boolean} isAdmin - Admin status (optional)
 * @param {string} expiresIn - Token expiration time (default: 8h)
 * @returns {string} JWT token
 */
const generateToken = (id, username, isAdmin = false, expiresIn = '8h') => {
  return jwt.sign(
    { 
      id, 
      username,
      isAdmin
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = { generateToken, verifyToken };