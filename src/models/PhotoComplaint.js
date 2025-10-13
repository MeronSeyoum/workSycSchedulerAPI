// models/PhotoComplaint.js
module.exports = (sequelize, DataTypes) => {
  const PhotoComplaint = sequelize.define('PhotoComplaint', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    photoId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
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
    resolvedAt: {
      type: DataTypes.DATE,
    },
    resolutionNote: {
      type: DataTypes.TEXT,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    timestamps: true,
    tableName: 'photo_complaints',
  });

  PhotoComplaint.associate = (models) => {
    PhotoComplaint.belongsTo(models.ShiftPhoto, { foreignKey: 'photoId' });
    PhotoComplaint.belongsTo(models.User, { 
      foreignKey: 'clientId', 
      as: 'client' 
    });
  };

  return PhotoComplaint;
};