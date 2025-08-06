// models/shift.model.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Shift = sequelize.define('Shift', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        isAfterStartTime(value) {
          if (this.start_time && value <= this.start_time) {
            throw new Error('End time must be after start time');
          }
        }
      }
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id'
      }
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    shift_type: {
      type: DataTypes.ENUM('regular', 'emergency'),
      allowNull: false,
      defaultValue: 'regular'
    }
  }, {
    tableName: 'shifts',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (shift) => {
        if (shift.start_time && shift.end_time) {
          if (shift.start_time >= shift.end_time) {
            throw new Error('End time must be after start time');
          }
        }
      }
    }
  });

  // Class Methods
  Shift.associate = (models) => {
    Shift.belongsTo(models.Client, {
      foreignKey: 'client_id',
      as: 'client'
    });
    Shift.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
    Shift.hasMany(models.EmployeeShift, {
      foreignKey: 'shift_id',
      as: 'employee_shifts'
    });
    Shift.hasMany(models.Attendance, {
      foreignKey: 'shift_id',
      as: 'attendances'
    });
    Shift.hasOne(models.QRCode, {
      foreignKey: 'shift_id',
      as: 'qrcode'
    });
  };

  return Shift;
};