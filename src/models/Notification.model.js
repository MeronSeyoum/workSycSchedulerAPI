module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    shiftId: {
      // Changed from tenantId to shiftId to match associations
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'shifts',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('assignment', 'update', 'reminder', 'cancellation', 'system', 'attendance'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    relatedEntityType: {
      type: DataTypes.ENUM('shift', 'user', 'employee', 'client', 'attendance', 'none'),
      defaultValue: 'none',
    },
    relatedEntityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Notification.belongsTo(models.Employee, {
      foreignKey: 'employeeId',
      as: 'employee',
    });
    Notification.belongsTo(models.Shift, {
      foreignKey: 'shiftId',
      as: 'shift',
    });
  };

  return Notification;
};
