const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PhotoComplaint = sequelize.define('PhotoComplaint', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    photo_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'shift_photos',
        key: 'id'
      }
    },
    client_id: {
      type: DataTypes.INTEGER, // Changed to INTEGER to match User.id
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.ENUM(
        'poor_quality',
        'task_incomplete',
        'wrong_location',
        'safety_concern',
        'other'
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('filed', 'under_review', 'resolved', 'dismissed'),
      defaultValue: 'filed',
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolution_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    timestamps: true,
    tableName: 'photo_complaints',
    underscored: true,
  });

  PhotoComplaint.associate = (models) => {
    PhotoComplaint.belongsTo(models.ShiftPhoto, { 
      foreignKey: 'photo_id',
      as: 'ShiftPhoto'
    });
    PhotoComplaint.belongsTo(models.User, { 
      foreignKey: 'client_id', 
      as: 'client' 
    });
  };

  return PhotoComplaint;
};