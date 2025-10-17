const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'general'
    },
    estimated_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    requires_photo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    sample_photo_url: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    client_specific: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clients',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'archived'),
      defaultValue: 'active'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    }
  }, {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
  
  });

  Task.associate = (models) => {
    Task.belongsTo(models.Client, {
      foreignKey: 'client_id',
      as: 'client'
    });
    
    Task.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
    
    Task.hasMany(models.ShiftPhoto, {
      foreignKey: 'task_id',
      as: 'shift_photos'
    });
  };

  return Task;
};