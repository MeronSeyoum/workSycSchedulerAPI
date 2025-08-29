const express = require('express');
const morgan = require('./config/morgan');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { errorConverter, errorHandler } = require('./middlewares/error');
const i18n = require('./config/i18n.config');
const db = require('./models');
const http = require('http');
const socketIo = require('socket.io');
const { initSocket } = require('./socket');

const v1Router = require('./routes/v1');

const app = express();
const server = http.createServer(app);

// Environment configuration
const env = process.env.NODE_ENV || 'development';
const envFiles = {
  production: '.env.production',
  staging: '.env.staging',
  development: '.env.development'
};
const envFile = envFiles[env] || '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Initialize Socket.io with proper CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://worksyc.vercel.app'] 
      : ['http://localhost:3000', 'https://worksyc.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for simplicity; configure as needed
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Development logging
if (process.env.NODE_ENV === 'development') {
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
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://worksyc.vercel.app'] 
    : ['http://localhost:3000', 'https://worksyc.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase event listeners limit
require('events').EventEmitter.defaultMaxListeners = 20;

// Initialize Socket.io
initSocket(io);

// Routes
app.get('/testing', (req, res) => {
  res.send('testing route');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

app.use('/api/v1', v1Router);

// Error handling
app.use(errorConverter);
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint does not exist',
    code: 404,
  });
});

// Database connection
const connectDatabase = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected successfully');
    await db.sequelize.sync({ force: false });
  } catch (error) {
    console.error('Database connection error:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

connectDatabase();

// Start server
const port = process.env.PORT || 8080;
if (require.main === module) {
  server.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.sequelize.close();
    console.log('Process terminated');
  });
});

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
