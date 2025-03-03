const winston = require('winston');
const path = require('path');
const config = require('../config');

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // Error log file transport
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
  }),
  
  // Combined log file transport
  new winston.transports.File({ 
    filename: path.join(logDir, 'combined.log') 
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});

// Add morgan stream for HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Create a simplified API for common logging operations
module.exports = {
  error: (message, meta = {}) => {
    logger.error(message, { meta });
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, { meta });
  },
  
  info: (message, meta = {}) => {
    logger.info(message, { meta });
  },
  
  http: (message, meta = {}) => {
    logger.http(message, { meta });
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, { meta });
  },
  
  // Allow direct access to the winston logger
  logger
};