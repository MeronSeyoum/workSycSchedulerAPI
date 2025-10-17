const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShiftPhoto = sequelize.define('ShiftPhoto', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shift_id: {
      type: DataTypes.INTEGER, // Changed to INTEGER to match Shift.id
      allowNull: false,
      references: {
        model: 'shifts',
        key: 'id'
      }
    },
    employee_id: {
      type: DataTypes.INTEGER, // Changed to INTEGER to match Employee.id
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id'
      }
    },
    photo_url: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    public_id: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    manager_approval_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    manager_approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    manager_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_task_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    geo_location: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'shift_photos',
    timestamps: true,
    underscored: true,
   
  });

  ShiftPhoto.associate = (models) => {
    ShiftPhoto.belongsTo(models.Shift, { 
      foreignKey: 'shift_id',
      as: 'shift',
      onDelete: 'CASCADE'
    });
    
    ShiftPhoto.belongsTo(models.Employee, { 
      foreignKey: 'employee_id', 
      as: 'employee',
      onDelete: 'CASCADE'
    });
    
    ShiftPhoto.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task',
      onDelete: 'SET NULL'
    });
    
    ShiftPhoto.hasMany(models.PhotoComplaint, { 
      foreignKey: 'photo_id',
      as: 'complaints',
      onDelete: 'CASCADE'
    });
  };

  return ShiftPhoto;
};