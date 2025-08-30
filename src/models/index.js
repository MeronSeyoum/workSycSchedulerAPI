const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const definitions = require('./definitions');

// Load environment variables
const env = process.env.NODE_ENV || 'development';
const isVercel = process.env.VERCEL === '1';

try {
  dotenv.config({
    path: path.resolve(process.cwd(), `config.${env}.env`),
  });
  console.log(`Loaded environment from config.${env}.env`);
} catch (error) {
  console.log(`config.${env}.env not found, using process environment variables`);
}

// Check if we have DATABASE_URL or individual config
let sequelize;

// Explicitly require pg package
const pg = require('pg');

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL (for production)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: pg, // Explicitly use pg module
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
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
      freezeTableName: true,
    },
  });
  console.log('Using DATABASE_URL for connection');
} else {
  // Use individual config (for development)
  const { DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PORT || !DB_PASSWORD || !DB_DATABASE) {
    console.error('Missing required database configuration in environment variables');
    process.exit(1);
  }

  sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    timezone: '-07:00',
    dialect: 'postgres',
    dialectModule: pg, // Explicitly use pg module
    dialectOptions: {
      ssl: {
        require: process.env.DB_SSL === 'true',
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
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
  console.log('Using individual DB config for connection');
}

// Load all models
const db = definitions(sequelize, Sequelize);

// Test and sync database connection
(async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    const syncOptions = {
      force: process.env.DB_FORCE_SYNC === 'true',
      alter: process.env.DB_ALTER_SYNC === 'true' && process.env.NODE_ENV === 'development',
    };

    // In production/vercel, only sync if needed
    if (process.env.NODE_ENV === 'production' || isVercel) {
      console.log('Skipping sync in production/Vercel environment');
    } else {
      await sequelize.sync(syncOptions);
      console.log(`Database synchronized (force: ${syncOptions.force}, alter: ${syncOptions.alter})`);
    }
  } catch (error) {
    console.error('Database connection failed:', error.message);
    
    // In production/Vercel, don't crash the app
    if (process.env.NODE_ENV === 'production' || isVercel) {
      console.log('Continuing without database connection');
    } else {
      process.exit(1);
    }
  }
})();

// Close connection on process termination
process.on('SIGINT', async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed');
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
// const env = process.env.NODE_ENV || 'development';

// try {
//   dotenv.config({
//     path: path.resolve(process.cwd(), `config.${env}.env`),
//   });
//   console.log(`Loaded environment from config.${env}.env`);
// } catch (error) {
//   console.log(`config.${env}.env not found, using process environment variables`);
// }

// // Validate required database configuration
// const { DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE } = process.env;

// if (!DB_HOST || !DB_USER || !DB_PORT || !DB_PASSWORD || !DB_DATABASE) {
//   console.error('Missing required database configuration in environment variables');
//   console.error('Required variables: DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE');
//   console.error('Please check your config.development.env file');
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
//       require: process.env.DB_SSL === 'true',
//       rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
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
//     console.log('Database connection established successfully');

//     const syncOptions = {
//       force: process.env.DB_FORCE_SYNC === 'true',
//       alter: process.env.DB_ALTER_SYNC === 'true',
//     };

//     await sequelize.sync(syncOptions);
//     console.log(`Database synchronized (force: ${syncOptions.force}, alter: ${syncOptions.alter})`);
//   } catch (error) {
//     console.error('Database connection failed:', error.message);
//     console.error('Error details:', error);
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