// models/Geofence.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Geofence = sequelize.define('Geofence', {
    id: {
      type: DataTypes.INTEGER,
           primaryKey: true,
           autoIncrement: true
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id'
      }
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    radius_meters: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 50,
        max: 5000
      }
    }
  }, {
    tableName: 'geofences',
    timestamps: true,
    underscored: true
  });

  // Class Methods
  Geofence.associate = (models) => {
    Geofence.belongsTo(models.Client, {
      foreignKey: 'client_id',
      as: 'client'
    });
  };

  return Geofence;
};