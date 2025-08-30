const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const definitions = require('./definitions');

// Load environment variables only in development
if (process.env.NODE_ENV === 'development') {
  dotenv.config({
    path: path.resolve(process.cwd(), `config.${process.env.NODE_ENV}.env`),
  });
}

// For Vercel/production, use DATABASE_URL if available
let sequelize;

if (process.env.DATABASE_URL) {
  // Use connection string (for Vercel, Heroku, etc.)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: require('pg'),
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      underscored: true,
      timestamps: true,
      freezeTableName: true,
    },
  });
} else {
  // Use individual DB config (for local development)
  const { DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PORT || !DB_PASSWORD || !DB_DATABASE) {
    console.error('Missing required database configuration in environment variables');
    
    // Don't exit in production - might be serverless environment without DB
    if (process.env.NODE_ENV === 'production') {
      console.log('Running in production without database connection (serverless mode)');
      // Create a mock sequelize instance to prevent crashes
      sequelize = { authenticate: () => Promise.resolve(), sync: () => Promise.resolve() };
    } else {
      process.exit(1);
    }
  } else {
    sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
      host: DB_HOST,
      port: DB_PORT,
      timezone: '-07:00',
      dialect: 'postgres',
      dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      } : {},
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
        underscored: true,
        timestamps: true,
        freezeTableName: true,
      },
    });
  }
}

// Load all models
const db = definitions(sequelize, Sequelize);

// Test and sync database connection (only if we have a real sequelize instance)
async function initializeDatabase() {
  try {
    // Skip if mock sequelize (serverless without DB)
    if (sequelize.authenticate === undefined) {
      console.log('Skipping database connection (serverless mode)');
      return;
    }

    await sequelize.authenticate();
    console.log('Database connection established successfully');

    const syncOptions = {
      force: process.env.DB_FORCE_SYNC === 'true',
      alter: process.env.DB_ALTER_SYNC === 'true',
    };

    await sequelize.sync(syncOptions);
    console.log(`Database synchronized (force: ${syncOptions.force}, alter: ${syncOptions.alter})`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    
    // Don't exit in production - might be expected in serverless
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

// Only initialize database if not in Vercel serverless environment
if (!process.env.VERCEL) {
  initializeDatabase();
} else {
  console.log('Running in Vercel environment - database initialization skipped');
}

// Close connection on process termination (if we have a real connection)
process.on('SIGINT', async () => {
  try {
    if (sequelize.close) {
      await sequelize.close();
      console.log('Database connection closed');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error closing database connection:', error.message);
    process.exit(1);
  }
});

module.exports = {
  ...db,
  sequelize,
  Sequelize,
};


// const Sequelize = require('sequelize');
// const dotenv = require('dotenv');
// const path = require('path');
// const definitions = require('./definitions');

// // Load environment variables
// dotenv.config({
//   path: path.resolve(process.cwd(), `config.${process.env.NODE_ENV}.env`),
// });

// // Validate required database configuration
// const { DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE } = process.env;

// if (!DB_HOST || !DB_USER || !DB_PORT || !DB_PASSWORD || !DB_DATABASE) {
//   console.error('Missing required database configuration in environment variables');
//   process.exit(1);
// }

// // Initialize Sequelize with SSL configuration
// const sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
//   host: DB_HOST,
//   port: DB_PORT,
//   timezone: '-07:00',
//   dialect: 'postgres',
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false,
//     },
//   },

//   pool: {
//     max: 5,
//     min: 0,
//     acquire: 30000,
//     idle: 10000,
//   },
//   logging: process.env.NODE_ENV === 'development' ? console.log : false,
//   define: {
//     underscored: true,
//     timestamps: true,
//     freezeTableName: true,
//   },
// });

// // Load all models
// const db = definitions(sequelize, Sequelize);

// // Test and sync database connection
// (async function initializeDatabase() {
//   try {
//     await sequelize.authenticate();
//     console.log('Database connection initiate and established successfully');

//     const syncOptions = {
//       force: process.env.DB_FORCE_SYNC === 'true',
//       alter: process.env.DB_ALTER_SYNC === 'true',
//     };

//     await sequelize.sync(syncOptions);
//     console.log(`Database synchronized (force: ${syncOptions.force}, alter: ${syncOptions.alter})`);
//   } catch (error) {
//     console.error('Database connection failed:', error.message);
//     process.exit(1);
//   }
// })();

// // Close connection on process termination
// process.on('SIGINT', async () => {
//   try {
//     await sequelize.close();
//     console.log('Database connection closed');
//     process.exit(0);
//   } catch (error) {
//     console.error('Error closing database connection:', error.message);
//     process.exit(1);
//   }
// });

// module.exports = {
//   ...db,
//   sequelize,
//   Sequelize,
// };