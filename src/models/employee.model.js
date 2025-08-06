const { DataTypes } = require('sequelize'); // Add this line
module.exports = (sequelize) => {
  const Employee = sequelize.define(
    'Employee',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      employee_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          is: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
        },
      },
      position: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      profile_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      status: {
        type: DataTypes.ENUM('active', 'on_leave', 'terminated', 'inactive', 'suspended'),
        defaultValue: 'active',
      },

      assigned_locations: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },

      contact: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          phone: '',
          emergencyContact: '',
          address: '',
        },
      },
      hire_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      termination_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: 'employees',
      timestamps: true,
      underscored: true,
      hooks: {
        beforeCreate: (employee) => {
          if (!employee.employee_code) {
            employee.employee_code = `EMP${Date.now()}`;
          }
        },
      },
    }
  );
  // Class Methods
  Employee.associate = (models) => {
    Employee.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    Employee.belongsToMany(models.Shift, {
      through: models.EmployeeShift,
      foreignKey: 'employee_id',
      as: 'shifts',
    });

    Employee.hasMany(models.Attendance, {
      foreignKey: 'employee_id',
      as: 'attendances',
    });
  };

  // Instance Methods
  Employee.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    // Remove sensitive fields
    delete values.user_id;
    delete values.created_at;
    delete values.updated_at;
    return values;
  };

  return Employee;
};
