module.exports = (sequelize, DataTypes) => {
  const EmployeeSkill = sequelize.define("EmployeeSkill", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    skill_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    proficiency: {
      type: DataTypes.INTEGER, // scale 1–5
      defaultValue: 3,
      validate: { min: 1, max: 5 },
    },
    certified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // requires certificate for validation
    },
    certification_expiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    years_of_experience: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    last_used: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "employee_skills",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["employee_id", "skill_id"] },
    ],
  });

  EmployeeSkill.associate = (models) => {
    EmployeeSkill.belongsTo(models.Employee, {
      foreignKey: "employee_id",
      as: "employee",
      onDelete: "CASCADE",
    });

    EmployeeSkill.belongsTo(models.Skill, {
      foreignKey: "skill_id",
      as: "skill",
      onDelete: "CASCADE",
    });
  };

  return EmployeeSkill;
};
