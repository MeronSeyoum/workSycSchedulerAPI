// index.js
const express = require('express');
const morgan = require('./config/morgan');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const { errorConverter, errorHandler } = require('./middlewares/error');
const i18n = require('./config/i18n.config');
const db = require('./models');
const http = require('http');
const socketIo = require('socket.io');
const { initSocket } = require('./socket');

const v1Router = require('./routes/v1');

const app = express();
const server = http.createServer(app);

// Environment configuration - Vercel friendly
const env = process.env.NODE_ENV || 'development';
console.log('Environment:', env);

// Load environment variables
if (env === 'development') {
  dotenv.config({ path: path.resolve(process.cwd(), 'config.DEVELOPMENT.env') });
}
// Production: Vercel automatically provides env variables

// Initialize Socket.io only if not in serverless environment
let io;
if (process.env.VERCEL !== '1') {
  io = socketIo(server, {
    cors: {
      origin: [
        'http://localhost:3000', 
        'https://worksyc.vercel.app',
        'https://worksyc-kbxiiocze-meronseyoums-projects.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  app.set('io', io);
  initSocket(io);
  console.log('Socket.io initialized');
} else {
  console.log('Socket.io disabled in serverless environment');
}

// Security middleware
app.use(helmet());

// Development logging
if (env === 'development') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Additional middleware
app.use(cookieParser());
app.use(xss());
app.use(compression());
app.use(i18n);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://worksyc.vercel.app',
    'https://worksyc-kbxiiocze-meronseyoums-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase event listeners limit
require('events').EventEmitter.defaultMaxListeners = 20;

// Test routes - CRITICAL for debugging
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Server is running!',
    timestamp: new Date().toISOString(),
    environment: env
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env
  });
});

// API routes
app.use('/api/v1', v1Router);

// Error handling
app.use(errorConverter);
app.use(errorHandler);

// 404 handler - must be last
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint does not exist',
    code: 404,
    requestedUrl: req.originalUrl
  });
});

// Database connection - only in non-serverless
if (process.env.VERCEL !== '1') {
  const connectDatabase = async () => {
    try {
      await db.sequelize.authenticate();
      console.log('Database connected successfully');
      await db.sequelize.sync({ force: false });
    } catch (error) {
      console.error('Database connection error:', error.message);
    }
  };
  connectDatabase();
}

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const port = process.env.PORT || 8080;
  server.listen(port, () => {
    console.log(`Server running in ${env} mode on port ${port}`);
  });
}

// Export for Vercel
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
