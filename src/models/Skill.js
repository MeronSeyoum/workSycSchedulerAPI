module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define("Skill", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    category: {
      type: DataTypes.STRING, // e.g., "Technical", "Soft Skill"
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    level_required: {
      type: DataTypes.INTEGER, // minimum level needed for assignments
      defaultValue: 1,
    },
    is_certified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: "skills",
    timestamps: true,
    underscored: true,
  });

  Skill.associate = (models) => {
    Skill.hasMany(models.EmployeeSkill, {
      foreignKey: "skill_id",
      as: "employeeSkills",
      onDelete: "CASCADE",
    });
  };

  return Skill;
};
