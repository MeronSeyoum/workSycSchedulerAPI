// models/QRCode.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const QRCode = sequelize.define('QRCode', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'Client',
        key: 'id'
      }
    },
    code_value: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'qrcodes',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: (qrcode) => {
        if (qrcode.expires_at < new Date()) {
          throw new Error('Expiration date must be in the future');
        }
      }
    }
  });

  // Class Methods
QRCode.associate = (models) => {
 db.QRCode.belongsTo(db.Client, {
  foreignKey: 'client_id',
  as: 'client'
});
};

  return QRCode;
};