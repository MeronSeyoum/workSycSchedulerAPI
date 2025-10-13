// models/ShiftPhoto.js
module.exports = (sequelize, DataTypes) => {
  const ShiftPhoto = sequelize.define('ShiftPhoto', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shiftId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    photoUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    publicId: {
      type: DataTypes.STRING, // Cloudinary public ID for deletion
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    managerApprovalStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    managerApprovedAt: {
      type: DataTypes.DATE,
    },
    managerComment: {
      type: DataTypes.TEXT,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    timestamps: true,
    tableName: 'shift_photos',
  });

  ShiftPhoto.associate = (models) => {
    ShiftPhoto.belongsTo(models.Shift, { foreignKey: 'shiftId' });
    ShiftPhoto.belongsTo(models.User, { 
      foreignKey: 'employeeId', 
      as: 'employee' 
    });
    ShiftPhoto.hasMany(models.PhotoComplaint, { 
      foreignKey: 'photoId',
      onDelete: 'CASCADE'
    });
  };

  return ShiftPhoto;
};