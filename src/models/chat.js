// models/chat.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Chat = sequelize.define(
    'Chat',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      chat_type: {
        type: DataTypes.ENUM('direct', 'broadcast', 'group'),
        defaultValue: 'direct',
        allowNull: false,
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'chats',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['sender_id'],
        },
        {
          fields: ['recipient_id'],
        },
        {
          fields: ['chat_type'],
        },
        {
          fields: ['created_at'],
        },
      ],
    }
  );

  Chat.associate = (models) => {
    Chat.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
    });
    
    Chat.belongsTo(models.User, {
      foreignKey: 'recipient_id',
      as: 'recipient',
    });
  };

  return Chat;
};