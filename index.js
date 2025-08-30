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
const socketIo = require('socket.io');
const { initSocket } = require('./src/socket');

const v1Router = require('./src/routes/v1');

const app = express();
const server = http.createServer(app);

// Environment configuration
const env = process.env.NODE_ENV || 'development';
console.log('🚀 Starting server in', env, 'environment');

// Load environment variables
if (env === 'development') {
  dotenv.config({ path: path.resolve(__dirname, '.env.development') });
} else if (env === 'production') {
  dotenv.config({ path: path.resolve(__dirname, '.env.production') });
}
// For Vercel: Environment variables are automatically injected

// Initialize Socket.io only if not in serverless environment
let io;
if (process.env.VERCEL !== '1') {
  io = socketIo(server, {
    cors: {
      origin: [
        'http://localhost:3000', 
        'https://worksyc.vercel.app',
        'https://worksyc-*.vercel.app',
        'https://worksyc-git-*.vercel.app'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });
  app.set('io', io);
  initSocket(io);
  console.log('✅ Socket.io initialized');
} else {
  console.log('ℹ️  Socket.io disabled in serverless environment');
}

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
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 WorkSyc API Server is running!',
    timestamp: new Date().toISOString(),
    environment: env,
    documentation: '/api/v1/docs' // If you have docs
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
    if (env === 'production') {
      process.exit(1);
    }
  }
};

// Start server only if not in serverless environment
if (process.env.VERCEL !== '1') {
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
    if (db.sequelize) {
      db.sequelize.close();
    }
    console.log('Process terminated');
  });
});

// Export for Vercel serverless functions
module.exports = app;




// const express = require('express');
// var morgan = require('./config/morgan');

// const path = require('path');
// const helmet = require('helmet');
// const dotenv = require('dotenv');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const xss = require('xss-clean');
// const compression = require('compression');
// const { errorConverter, errorHandler } = require('./middlewares/error');
// const i18n = require('./config/i18n.config');
// const db = require('./models');

// const v1Router = require('./routes/v1');

// const app = express();

// dotenv.config({
//   path: path.resolve(process.cwd(), `config.${process.env.NODE_ENV || 'development'}.env`)
// });
// // Set security HTTP headers
// app.use(helmet());

// // Development logging
// if (process.env.NODE_ENV === 'DEVELOPMENT') {
//   app.use(morgan.successHandler);
//   app.use(morgan.errorHandler);
// }

// // Body parser, reading data from body into req.body
// app.use(express.json({ limit: '10kb' }));
// // parse urlencoded request body
// app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// // Cookie parser
// app.use(cookieParser());

// // Data sanitization against XSS
// app.use(xss());

// // Compress all routes

// app.use(compression());

// // Internationalization
// app.use(i18n);

// // Serving static files
// app.use(express.static(path.join(__dirname, 'public')));

// app.use(cors({
//   origin: [
//     'http://localhost:3000', 
//     'https://worksyc.vercel.app/',
//     'https://worksyc-kbxiiocze-meronseyoums-projects.vercel.app'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));


// const EventEmitter = require('events');
// EventEmitter.defaultMaxListeners = 15; // Set to a reasonable number

// // Routes
// app.use('/api/v1', v1Router);

// // Convert error to ApiError, if needed
// app.use(errorConverter);

// // Error handler, send stacktrace only during development
// app.use(errorHandler);

// // send back a 404 error for any unknown api request
// app.use((req, res, next) => {
//   res.status(404).json({
//     success: false,
//     message: 'API endpoint doesnt exist',
//     code: 404,
//   });
// });

// db.sequelize.sync({ force: false }).then(() => {
//   console.log('server Database connected');
// });

// // Start server
// if (process.env.NODE_ENV !== 'production') {
//   const port = process.env.PORT || 8080;
//   app.listen(port, () => {
//     console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
//   });
// }
