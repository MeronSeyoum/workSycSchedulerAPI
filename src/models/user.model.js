const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      password: {
        type: DataTypes.STRING(128),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      role: {
        type: DataTypes.ENUM('admin', 'manager', 'employee'),
        defaultValue: 'employee',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active',
      },
      salt: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      is_login: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reset_code: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      reset_code_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['email'],
        },
      ],
    }
  );
  User.associate = (models) => {
    User.hasOne(models.Employee, {
      foreignKey: 'user_id',
      as: 'employee',
    });

    User.hasMany(models.Shift, {
      foreignKey: 'created_by',
      as: 'created_shifts',
    });

    User.hasMany(models.EmployeeShift, {
      foreignKey: 'assigned_by',
      as: 'assigned_shifts',
    });
    User.hasMany(models.Notification, {
      foreignKey: 'userId',
      as: 'notifications',
      onDelete: 'CASCADE'
    });

    User.hasMany(models.Chat, {
    foreignKey: 'sender_id',
    as: 'sent_messages',
  });
  
  User.hasMany(models.Chat, {
    foreignKey: 'recipient_id',
    as: 'received_messages',
  });
  };

  return User;
};
