/**
 * WorkShift API Server - Main Application File
 * 
 * This file sets up the Express server with all necessary middleware,
 * routes, error handling, and Socket.io integration for real-time features.
 */

// ==================== CORE DEPENDENCIES ====================
const express = require('express');
const morgan = require('./src/config/morgan');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const http = require('http');
const socketio = require('socket.io');
// const cloudinary = require('cloudinary').v2;


// ==================== CUSTOM MODULES ====================
const { errorConverter, errorHandler } = require('./src/middlewares/error');
const i18n = require('./src/config/i18n.config');
const db = require('./src/models');
const v1Router = require('./src/routes/v1');

// ==================== CONFIGURATION ====================
const app = express();
const server = http.createServer(app);

// Environment configuration
const env = process.env.NODE_ENV || 'development';
const isVercel = process.env.VERCEL === '1';

console.log('🚀 Starting server. Vercel:', isVercel, 'Environment:', env);

// Load environment-specific variables
configureEnvironment(env, isVercel);

// CORS allowed origins configuration
const allowedOrigins = configureCorsOrigins();

// ==================== MIDDLEWARE SETUP ====================

// Security middleware - Helmet with specific configuration
app.use(helmet({
  contentSecurityPolicy: false,        // Disabled for flexibility with various content types
  crossOriginEmbedderPolicy: false     // Disabled to allow cross-origin requests
}));

// Development logging with Morgan
if (env === 'development') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Body parsing middleware with increased limits for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Additional security and utility middleware
app.use(cookieParser());               // Parse cookies
app.use(xss());                        // Prevent XSS attacks
app.use(compression());                // Compress responses
app.use(i18n);                         // Internationalization support

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'src/public')));

// CORS configuration for cross-origin requests
app.use(configureCors(allowedOrigins));

// Handle preflight requests for all routes
app.options('*', cors());

// Increase event listeners limit to prevent potential memory issues
require('events').EventEmitter.defaultMaxListeners = 20;

// ==================== SOCKET.IO SETUP ====================

// Initialize Socket.io for real-time communication
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,            // Allow same origins as HTTP
    methods: ['GET', 'POST'],          // Allowed HTTP methods
    credentials: true                  // Allow cookies and authentication
  }
});

// Store the io instance in the app for access in routes
app.set('io', io);

// Socket.io connection handling with error prevention
configureSocketIO(io);


// ==================== cloudinary SETUP ====================

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// ==================== ROUTES SETUP ====================

// Health check endpoint (essential for Vercel and monitoring)
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

// Root endpoint - API welcome message
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 WorkShift API Server is running!',
    timestamp: new Date().toISOString(),
    environment: env,
    vercel: isVercel
  });
});

// API version 1 routes
app.use('/api/v1', v1Router);

// ==================== ERROR HANDLING ====================

// Convert errors to standardized ApiError format
app.use(errorConverter);

// Handle all errors with appropriate responses
app.use(errorHandler);

// 404 handler - must be the last route
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '🔍 Endpoint not found',
    code: 404,
    requestedUrl: req.originalUrl,
    availableEndpoints: ['/', '/health', '/api/v1/']
  });
});

// ==================== DATABASE & SERVER STARTUP ====================

// Connect to database if not in serverless environment
if (!isVercel) {
  connectDatabase();
}

// Start the server (only if not in Vercel environment)
if (!isVercel) {
  startServer(server, env);
} else {
  console.log('ℹ️  Running in Vercel environment - serverless mode');
}

// Export for Vercel serverless functions
module.exports = app;

// ==================== CONFIGURATION FUNCTIONS ====================

/**
 * Configure environment variables based on current environment
 * @param {string} env - Current environment (development/production)
 * @param {boolean} isVercel - Whether running on Vercel
 */
function configureEnvironment(env, isVercel) {
  if (env === 'development') {
    dotenv.config({ path: path.resolve(__dirname, '.env.development') });
  } else if (env === 'production' && !isVercel) {
    dotenv.config({ path: path.resolve(__dirname, '.env.production') });
  }
  // For Vercel: Environment variables are automatically injected
}

/**
 * Configure CORS allowed origins based on environment
 * @returns {Array} Array of allowed origins
 */
function configureCorsOrigins() {
  return [
    'http://localhost:3000', // Local development
    'https://worksyc.vercel.app', // Production
    'https://worksyc-git-main-meronseyoums-projects.vercel.app', // Vercel preview
    'https://worksyc-k0geo7syd-meronseyoums-projects.vercel.app', // Vercel preview
    /\.vercel\.app$/ // Regex to match all Vercel subdomains
  ];
}

/**
 * Configure CORS middleware with custom validation
 * @param {Array} allowedOrigins - Array of allowed origins
 * @returns {Function} CORS middleware function
 */
function configureCors(allowedOrigins) {
  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  });
}

/**
 * Configure Socket.IO with connection handling and events
 * @param {Object} io - Socket.IO instance
 */
function configureSocketIO(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join user to their own room for private messages
    socket.on('joinUser', (userId) => {
      if (userId && typeof userId === 'string' || typeof userId === 'number') {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their room`);
      } else {
        console.warn('Invalid userId received for joinUser event');
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('User disconnected:', socket.id, 'Reason:', reason);
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
  
  // Handle overall Socket.IO server errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });
}

/**
 * Connect to database and sync models in proper order
 */
async function connectDatabase() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync models in correct order to avoid foreign key issues
    await db.sequelize.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Define the correct order for table synchronization based on dependencies
    const syncOrder = [
      'User',           // Base table with no dependencies
      'Client',         // Depends on User
      'Employee',       // Depends on User
      'Shift',          // Depends on Client and User
      'Geofence',       // Depends on Client
      'QRCode',         // Depends on Client
      'Token',          // Depends on User
      'EmployeeShift',  // Depends on Employee and Shift
      'Attendance',     // Depends on Employee and Shift
      'Notification',   // Depends on User
      'Chat',            // Depends on User (sender_id, recipient_id)
      'task',
      'shiftPhoto',
      'PhotoComplaint'

    ];
    
    // Filter to only include models that exist
    const modelNames = Object.keys(db.sequelize.models);
    const modelsToSync = syncOrder.filter(modelName => 
      modelNames.includes(modelName)
    );
    
    // Sync models in the correct order
    for (const modelName of modelsToSync) {
      console.log(`🔄 Syncing model: ${modelName}`);
      await db.sequelize.models[modelName].sync({ 
        force: false, 
        alter: env === 'development' // Only alter tables in development
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
    
    // In production, exit if DB connection fails (non-Vercel)
    if (env === 'production' && !isVercel) {
      process.exit(1);
    }
  }
}

/**
 * Start the HTTP server
 * @param {Object} server - HTTP server instance
 * @param {string} env - Current environment
 */
function startServer(server, env) {
  const PORT = process.env.PORT || 8080;
  
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Environment: ${env}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 Socket.io is enabled`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    }
  });
}