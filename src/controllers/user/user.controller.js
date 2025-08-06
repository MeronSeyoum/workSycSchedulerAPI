const { User } = require('../../models');
const { userValidation } = require('../../validations');
const { hashPassword } = require('../../helper/encrypter');

exports.getAll = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const where = {};
    
    if (role) where.role = role;
    if (status) where.status = status;
    
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({ 
      where,
      attributes: { exclude: ['password', 'salt'] },
      order: [['created_at', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve users',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { error } = userValidation.getUser.params.validate(req.params);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password', 'salt'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve user',
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    // Validate request body
    const { error } = userValidation.createUser.body.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check for duplicate email
    const existingUser = await User.findOne({ 
      where: { email: req.body.email } 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Email already in use',
        error: `The email "${req.body.email}" is already registered`
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(req.body.password);

    // Create user
    const user = await User.create({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      password: hashedPassword,
      role: req.body.role || 'employee',
      status: req.body.status || 'active',
      profile_image: req.body.profile_image || null
    });

    // Exclude sensitive fields from response
    const userResponse = user.get();
    delete userResponse.password;
    delete userResponse.salt;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      message: 'Failed to create user',
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    // Validate params and body
    // const { error: paramsError } = userValidation.updateUser.params.validate(req.params);
    // if (paramsError) return res.status(400).json({ error: paramsError.details[0].message });

    // const { error: bodyError } = userValidation.updateUser.body.validate(req.body);
    // if (bodyError) return res.status(400).json({ error: bodyError.details[0].message });

    // Find user
    const user = await User.findByPk(req.body.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for email conflict if changing
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ 
        where: { email: req.body.email } 
      });
      if (emailExists) {
        return res.status(400).json({ 
          message: 'Email already in use',
          error: `The email "${req.body.email}" is already registered`
        });
      }
    }

    // Update user
    await user.update({
      first_name: req.body.first_name || user.first_name,
      last_name: req.body.last_name || user.last_name,
      email: req.body.email || user.email,
      role: req.body.role || user.role,
      status: req.body.status || user.status,
      profile_image: req.body.profile_image || user.profile_image
    });

    // Exclude sensitive fields from response
    const userResponse = user.get();
    delete userResponse.password;
    delete userResponse.salt;

    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      message: 'Failed to update user',
      error: error.message,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    // Validate params
    const { error } = userValidation.deleteUser.params.validate(req.params);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Find and delete user
    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.destroy();

    res.json({ 
      message: 'User deleted successfully',
      deletedId: req.params.userId
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { error } = userValidation.resetPassword.params.validate(req.params);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate temporary password and hash it
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    
    await user.update({
      password: hashedPassword,
      password_reset_token: null,
      password_reset_expires: null
    });

    // In a real app, you would send the tempPassword via email
    console.log(`Temporary password for ${user.email}: ${tempPassword}`);

    res.json({ 
      message: 'Password reset successfully',
      userId: req.params.userId
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ 
      message: 'Failed to reset password',
      error: error.message,
    });
  }
};

// Helper function to generate temporary password
function generateTempPassword() {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}