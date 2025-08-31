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

const v1Router = require('./src/routes/v1');

const app = express();

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
    'https://work-syc-scheduler-api.vercel.app',
    'https://work-syc-*.vercel.app',
    'https://worksyc-git-main-meronseyoums-projects.vercel.app',
    'https://worksyc-k0geo7syd-meronseyoums-projects.vercel.app'
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
    message: '🚀 WorkShift API Server is running!',
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

// Database connection - only for non-serverless environments
const connectDatabase = async () => {
  try {
    if (isVercel) {
      console.log('ℹ️  Skipping database connection in serverless environment');
      return;
    }
    
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync models in correct order to avoid foreign key issues
    // First sync tables without foreign key dependencies
    await db.sequelize.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Sync tables in proper order based on dependencies
    const modelNames = Object.keys(db.sequelize.models);
    
    // Define the correct order for table synchronization
    const syncOrder = [
      'User',        // Base table with no dependencies
      'Client',      // Depends on User
      'Employee',    // Depends on User
      'Shift',       // Depends on Client and User
      'Geofence',    // Depends on Client
      'QRCode',      // Depends on Client
      'Token',       // Depends on User
      'EmployeeShift', // Depends on Employee and Shift
      'Attendance',  // Depends on Employee and Shift
      'Notification' // Depends on User
    ];
    
    // Filter to only include models that exist
    const modelsToSync = syncOrder.filter(modelName => 
      modelNames.includes(modelName)
    );
    
    // Sync models in the correct order
    for (const modelName of modelsToSync) {
      console.log(`🔄 Syncing model: ${modelName}`);
      await db.sequelize.models[modelName].sync({ 
        force: false, 
        alter: env === 'development' 
      });
    }
    
    console.log('✅ Database synced successfully');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    
    // Try a safer sync approach if the ordered sync fails
    if (error.name.includes('ForeignKey')) {
      console.log('🔄 Retrying with basic sync (no alter)...');
      try {
        await db.sequelize.sync({ force: false, alter: false });
        console.log('✅ Database synced with safe options');
      } catch (safeError) {
        console.error('❌ Safe sync also failed:', safeError.message);
      }
    }
    
    // In production, you might want to exit if DB connection fails
    if (env === 'production' && !isVercel) {
      process.exit(1);
    }
  }
};

// Connect to database if not in serverless environment
if (!isVercel) {
  connectDatabase();
}

// Start the server (only if not in Vercel environment)
if (!isVercel) {
  const PORT = process.env.PORT || 8080;
  
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Environment: ${env}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  });
} else {
  console.log('ℹ️  Running in Vercel environment - serverless mode');
}

// Export for Vercel serverless functions
module.exports = app;