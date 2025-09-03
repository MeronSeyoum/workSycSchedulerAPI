module.exports = (sequelize, DataTypes) => {
  const EmployeeAvailability = sequelize.define("EmployeeAvailability", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    day_of_week: {
      type: DataTypes.ENUM(
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ),
      allowNull: false,
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: true, // true = applies every week
    },
    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "employee_availabilities",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["employee_id", "day_of_week"] },
    ],
  });

  EmployeeAvailability.associate = (models) => {
    EmployeeAvailability.belongsTo(models.Employee, {
      foreignKey: "employee_id",
      as: "employee",
      onDelete: "CASCADE",
    });
  };

  return EmployeeAvailability;
};
