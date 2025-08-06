const crypto = require('crypto');
const { Employee, User } = require('../../models');
const { employeeValidation } = require('../../validations');
const { profile } = require('console');
exports.getAll = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: [
        {
          model: User,
          as: 'user', // Must match the alias defined in your association
          attributes: ['first_name', 'last_name', 'email'],
          required: true,
        },
      ],
    });

    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: 'No employees found' });
    }

    const formatted = employees
      .map((emp) => {
        if (!emp.user) {
          console.warn(`Employee ${emp.id} has no associated User`);
          return null;
        }

        return {
          id: emp.id,
          first_name: emp.user.first_name,
          last_name: emp.user.last_name,
          email: emp.user.email,
          employee_code: emp.employee_code,
          phone_number: emp.phone_number,
          position: emp.position,
          profile_image_url: emp.profile_image_url,         
          status: emp.status,
          hire_date: emp.hire_date,
          termination_date: emp.termination_date,
          assigned_locations: emp.assigned_locations,        
          contact: emp.contact || {},
          createdAt: emp.createdAt,
          updatedAt: emp.updatedAt,
        };
      })
      .filter((emp) => emp !== null);

    res.json(formatted);
  } catch (error) {
    console.error('Detailed fetch error:', {
      message: error.message,
      stack: error.stack,
      original: error.original,
    });
    res.status(500).json({
      message: 'Failed to retrieve employees',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.create = async (req, res) => {
  try {
    const { error } = employeeValidation.create.body.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join(', ') });
    }

    const {
      first_name,
      last_name,
      email,
      employee_code,
      phone_number,
      position,
      status,
      hire_date,
      termination_date,
      profile_image_url,
      assigned_locations,
      contact,
    } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create User first
    const salt = crypto.randomBytes(16).toString('hex');
    const password = 'TempPass123!';
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

    const user = await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      salt,
    });

    // Then create Employee
    const employee = await Employee.create({
      user_id: user.id,
      employee_code,
      phone_number,
      position,
      status,
      hire_date,
      termination_date,
      profile_image_url,
      assigned_locations,
      contact,
    });

    res.status(201).json({
      id: employee.id,
      message: 'Employee created successfully',
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const user = await User.findByPk(employee.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Associated user not found' });
    }

    // Remove id from body if it exists
    const body = { ...req.body };
    delete body.id;

    const {
      first_name,
      last_name,
      email,
      phone_number,
      position,
      status,
      hire_date,
      termination_date,
      assigned_locations,
      profile_image_url,
      contact,
    } = body;

    // Check if email is being changed to an existing one
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({
          message: 'Email already in use',
          error: `The email ${email} is already registered`,
        });
      }
    }

    await user.update({ first_name, last_name, email });
    await employee.update({
      phone_number,
      position,
      status,
      hire_date,
      termination_date,
      profile_image_url,
      assigned_locations,
      contact,
    });

    res.json({
      message: 'Employee updated successfully',
      data: {
        id: employee.id,
        first_name,
        last_name,
        email,
      },
    });
  } catch (error) {
    console.error('Detailed update error:', {
      message: error.message,
      stack: error.stack,
      original: error.original,
    });
    res.status(500).json({
      message: 'Failed to update employee',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Delete the associated User first (if needed)
    await User.destroy({ where: { id: employee.user_id } });

    // Then delete the Employee
    await employee.destroy();

    res.json({
      message: 'Employee deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      message: 'Failed to delete employee',
      error: error.message,
    });
  }
};
