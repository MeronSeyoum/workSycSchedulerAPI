
const definitions = (sequelize, Sequelize) => {
  const db = {
    Sequelize,
    sequelize,
    Op: Sequelize.Op
  };

  // Initialize all models
  db.User = require('./user.model')(sequelize, Sequelize);
  db.Token = require('./token.model')(sequelize, Sequelize);
  db.Employee = require('./employee.model')(sequelize, Sequelize);
  db.Shift = require('./shift.model')(sequelize, Sequelize);
  db.Client = require('./client.model')(sequelize, Sequelize);
  db.Geofence = require('./Geofence.model')(sequelize, Sequelize);
  db.QRCode = require('./QRCode.model')(sequelize, Sequelize);
  db.Attendance = require('./Attendance.model')(sequelize, Sequelize);
  db.EmployeeShift = require('./EmployeeShift.model')(sequelize, Sequelize);

  // ====================
  // 1. USER ASSOCIATIONS
  // ====================
  db.User.hasOne(db.Employee, {
    foreignKey: 'user_id',
    as: 'employee',
    onDelete: 'CASCADE'
  });
  
  db.User.hasMany(db.Token, {
    foreignKey: 'user_id',
    as: 'tokens',
    onDelete: 'CASCADE'
  });

  db.User.hasMany(db.Shift, {
    foreignKey: 'created_by',
    as: 'created_shifts'
  });

  db.User.hasMany(db.EmployeeShift, {
    foreignKey: 'assigned_by',
    as: 'assigned_shifts',
    onDelete: 'SET NULL'
  });

  // ========================
  // 2. EMPLOYEE ASSOCIATIONS
  // ========================
  db.Employee.belongsTo(db.User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  db.Employee.hasMany(db.EmployeeShift, {
    foreignKey: 'employee_id',
    as: 'shift_assignments',
    onDelete: 'CASCADE'
  });

  db.Employee.hasMany(db.Attendance, {
    foreignKey: 'employee_id',
    as: 'attendances',
    onDelete: 'CASCADE'
  });

  // =====================
  // 3. SHIFT ASSOCIATIONS
  // =====================
  db.Shift.belongsTo(db.Client, {
    foreignKey: 'client_id',
    as: 'client'
  });

  db.Shift.belongsTo(db.User, {
    foreignKey: 'created_by',
    as: 'creator',
    onDelete: 'SET NULL'
  });

  db.Shift.hasMany(db.EmployeeShift, {
    foreignKey: 'shift_id',
    as: 'employee_shifts',
    onDelete: 'CASCADE'
  });

  db.Shift.hasMany(db.Attendance, {
    foreignKey: 'shift_id',
    as: 'attendances',
    onDelete: 'CASCADE'
  });

  // =============================
  // 4. MANY-TO-MANY EMPLOYEE<->SHIFT
  // =============================
  db.Employee.belongsToMany(db.Shift, {
    through: db.EmployeeShift,
    foreignKey: 'employee_id',
    otherKey: 'shift_id',
    as: 'shifts'
  });

  db.Shift.belongsToMany(db.Employee, {
    through: db.EmployeeShift,
    foreignKey: 'shift_id',
    otherKey: 'employee_id',
    as: 'employees'
  });

  // ======================
  // 5. CLIENT ASSOCIATIONS
  // ======================
  db.Client.hasMany(db.Shift, {
    foreignKey: 'client_id',
    as: 'shifts',
    onDelete: 'CASCADE'
  });

  db.Client.hasMany(db.Geofence, {
    foreignKey: 'client_id',
    as: 'geofences',
    onDelete: 'CASCADE'
  });

  // Client has ONE QRCode (critical change)
  db.Client.hasOne(db.QRCode, {
    foreignKey: 'client_id',
    as: 'qrcode',  // Singular because it's hasOne
    onDelete: 'CASCADE'
  });

  // =============================
  // 6. EMPLOYEE_SHIFT ASSOCIATIONS
  // =============================
  db.EmployeeShift.belongsTo(db.Employee, {
    foreignKey: 'employee_id',
    as: 'employee'
  });

  db.EmployeeShift.belongsTo(db.Shift, {
    foreignKey: 'shift_id',
    as: 'shift'
  });

  db.EmployeeShift.belongsTo(db.User, {
    foreignKey: 'assigned_by',
    as: 'assigner',
    onDelete: 'SET NULL'
  });

  // ========================
  // 7. ATTENDANCE ASSOCIATIONS
  // ========================
  db.Attendance.belongsTo(db.Employee, {
    foreignKey: 'employee_id',
    as: 'employee'
  });

  db.Attendance.belongsTo(db.Shift, {
    foreignKey: 'shift_id',
    as: 'shift'
  });

  // =====================
  // 8. QRCODE ASSOCIATIONS
  // =====================
  db.QRCode.belongsTo(db.Client, {
    foreignKey: 'client_id',
    as: 'client'
  });

  // ======================
  // 9. GEOFENCE ASSOCIATIONS
  // ======================
  db.Geofence.belongsTo(db.Client, {
    foreignKey: 'client_id',
    as: 'client'
  });

  return db;
};

module.exports = definitions;