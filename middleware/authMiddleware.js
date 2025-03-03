const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// Middleware to authenticate user via JWT token
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in the Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by id from decoded token
      const user = await User.findById(decoded.id).select('-password -salt -recoveryPhrase');
      
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      // Add user to request
      req.user = decoded;
      next();
      
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed', error: error.message });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Admin role check middleware (for future use)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, isAdmin };