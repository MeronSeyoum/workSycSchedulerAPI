const express = require('express');
const morgan = require('./src/config/morgan');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const { errorConverter, errorHandler } = require('./src/middlewares/error');
const i18n = require('./src/config/i18n.config');
const db = require('./src/models');
const http = require('http');

const v1Router = require('./src/routes/v1');

const app = express();
const server = http.createServer(app);

// Environment configuration
const env = process.env.NODE_ENV || 'development';
const isVercel = process.env.VERCEL === '1';

console.log('🚀 Starting server. Vercel:', isVercel, 'Environment:', env);

// Load environment variables
if (env === 'development') {
  dotenv.config({ path: path.resolve(__dirname, '.env.development') });
} else if (env === 'production' && !isVercel) {
  dotenv.config({ path: path.resolve(__dirname, '.env.production') });
}
// For Vercel: Environment variables are automatically injected

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Development logging
if (env === 'development') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Additional middleware
app.use(cookieParser());
app.use(xss());
app.use(compression());
app.use(i18n);

// Static files
app.use(express.static(path.join(__dirname, 'src/public')));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://worksyc.vercel.app',
    'https://worksyc-*.vercel.app',
    'https://worksyc-git-*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

// Increase event listeners limit
require('events').EventEmitter.defaultMaxListeners = 20;

// ==================== ROUTES ====================

// Health check endpoint (essential for Vercel)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env,
    vercel: isVercel,
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Bravo API Server is running!',
    timestamp: new Date().toISOString(),
    environment: env,
    vercel: isVercel
  });
});

// API routes
app.use('/api/v1', v1Router);

// ==================== ERROR HANDLING ====================

// Convert errors to ApiError
app.use(errorConverter);

// Handle errors
app.use(errorHandler);

// 404 handler - must be last
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '🔍 Endpoint not found',
    code: 404,
    requestedUrl: req.originalUrl,
    availableEndpoints: ['/', '/health', '/api/v1/']
  });
});

// ==================== DATABASE & SERVER START ====================

// Database connection
const connectDatabase = async () => {
  try {
    if (isVercel) {
      console.log('ℹ️  Skipping database connection in serverless environment');
      return;
    }
    
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync models (safe for production)
    await db.sequelize.sync({ 
      force: false, // NEVER true in production
      alter: env === 'development' // Auto-update tables in dev only
    });
    console.log('✅ Database synced');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    // In production, you might want to exit if DB connection fails
    if (env === 'production' && !isVercel) {
      process.exit(1);
    }
  }
};

// Start server only if not in serverless environment
if (!isVercel) {
  const PORT = process.env.PORT || 8080;
  
  connectDatabase().then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server running in ${env} mode on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API: http://localhost:${PORT}/api/v1`);
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    if (db.sequelize && !isVercel) {
      db.sequelize.close();
    }
    console.log('Process terminated');
  });
}); // Fixed: Added missing closing bracket and parenthesis

// Export for Vercel serverless functions
module.exports = app;