// models/EmployeeShift.js
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const EmployeeShift = sequelize.define('EmployeeShift', {
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
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'missed', 'in_progress', 'cancelled', 'draft'),
      allowNull: false,
      defaultValue: 'scheduled'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'employee_shifts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['employee_id', 'shift_id']
      }
    ]
  });

  // Class Methods
 EmployeeShift.associate = (models) => {
    EmployeeShift.belongsTo(models.Employee, {
      foreignKey: 'employee_id',
      as: 'employee'
    });
    EmployeeShift.belongsTo(models.Shift, {
      foreignKey: 'shift_id',
      as: 'shift'
    });
    EmployeeShift.belongsTo(models.User, {
      foreignKey: 'assigned_by',
      as: 'assigner'
    });
  };


  return EmployeeShift;
};