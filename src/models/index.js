const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const definitions = require('./definitions');



// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd(), `config.${process.env.NODE_ENV}.env`),
});

// Validate required database configuration
const { DB_HOST, DB_USER, DB_PORT, DB_PASSWORD, DB_DATABASE, DB_SSL } = process.env;

if (!DB_HOST || !DB_USER || !DB_PORT || !DB_PASSWORD || !DB_DATABASE) {
  console.error('Missing required database configuration in environment variables');
  process.exit(1);
}

// Initialize Sequelize with SSL configuration
const sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
   timezone: 'UTC', // Force UTC timezone
  dialect: 'postgres',
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
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
    freezeTableName: true
  }
});

// Load all models
const db = definitions(sequelize, Sequelize);

// Test and sync database connection
(async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection initiate and established successfully');
    
    const syncOptions = {
      force: process.env.DB_FORCE_SYNC === 'true',
      alter: process.env.DB_ALTER_SYNC === 'true'
    };
    
    await sequelize.sync(syncOptions);
    console.log(`Database synchronized (force: ${syncOptions.force}, alter: ${syncOptions.alter})`);
    
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
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
  Sequelize
};