// models/client.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Client = sequelize.define('Client', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    business_name: {  // Keeping your original field name
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
      }
    },
    contact_person: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_address: {  // Keeping as JSONB
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      }
    },
    status: {  // Keeping your status field
      type: DataTypes.ENUM('active', 'inactive', 'on_hold'),
      defaultValue: 'active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'clients',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (client) => {
        if (client.geo_latitude && !client.geo_longitude) {
          throw new Error('Both latitude and longitude must be provided');
        }
        if (!client.geo_latitude && client.geo_longitude) {
          throw new Error('Both latitude and longitude must be provided');
        }
      }
    }
  });

  Client.associate = (models) => {
    Client.hasMany(models.Shift, {
      foreignKey: 'client_id',
      as: 'shifts'
    });
    
    Client.hasMany(models.Geofence, {
      foreignKey: 'client_id',
      as: 'geofences'
    });
  
 db.Client.hasOne(db.QRCode, {
  foreignKey: 'client_id',
  as: 'qrcode',  // Changed from 'qrcodes' to 'qrcode' since it's hasOne
  onDelete: 'CASCADE'
});
  };

  return Client;
};