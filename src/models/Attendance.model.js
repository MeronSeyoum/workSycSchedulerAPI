// models/Attendance.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'shifts',
        key: 'id'
      }
    },
    clock_in_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    clock_out_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    hours:{
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    method: {
      type: DataTypes.ENUM('geofence', 'qrcode', 'manual'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending',
    'present',
    'late_arrival',
    'early_departure',
    'late_and_early',
    'absent',
    'on_leave',
    'partial_attendance',
    'no_show',
    'excused_absence'),
      allowNull: false,
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'attendances',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: (attendance) => {
        if (attendance.clock_out_time && attendance.clock_out_time < attendance.clock_in_time) {
          throw new Error('Clock out time cannot be before clock in time');
        }
      }
    }
  });

  // Class Methods
  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Employee, {
      foreignKey: 'employee_id',
      as: 'employee'
    });
    
    Attendance.belongsTo(models.Shift, {
      foreignKey: 'shift_id',
      as: 'shift'
    });
  };

  return Attendance;
};