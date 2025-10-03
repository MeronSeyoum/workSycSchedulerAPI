const httpStatus = require('http-status');
const { User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const Encrypter = require('../../helper/encrypter');
const crypto = require('crypto');

const signUp = async (body, res) => {
  const { first_name, last_name, email, password, password_again } = body;
  const user = await checkUserByEmail(email);
  if (user) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('email_already_exist'));
  }
  if (password !== password_again) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('password_not_match'));
  }
  const pass = await Encrypter.password_enc(password);

  const createUser = await User.create({
    first_name,
    last_name,
    email,
    password: pass.encr,
    salt: pass.salt,   
    role: 'employee',
    status: 'active',
    is_login: false,
  });
  if (!createUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('something_wrong'));
  }
  return createUser;
};

const signIn = async (body, res) => {
  const { email, password } = body;
  const user = await checkUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('user_not_found'));
  }
  if (user.salt === null) {
    throw new ApiError(httpStatus.FORBIDDEN, res.__('user_not_found'));
  }
  const pass = await Encrypter.password_dec(password, user.salt);
  if (pass !== user.password) {
    throw new ApiError(httpStatus.FORBIDDEN, res.__('incorrect_password'));
  }
  user.is_login = true;
  await user.save();
  return user;
};

const checkUserByEmail = async (email) => {
  const user = await User.findOne({ where: { email } });
  return user;
};

const logout = async (user, token) => {
  // Blacklist the current token
  const { tokenService } = require('../../services');
  await tokenService.blacklistToken(token);
  
  // Update user's login status
  await user.update({ is_login: false });
};

/**
 * Change password for authenticated user
 */
const changePassword = async (user, body, res) => {
  const { current_password, new_password, confirm_password } = body;
  
  // Re-fetch user from database to ensure we have salt
  const fullUser = await User.findByPk(user.id);
  
  if (!fullUser) {
    throw new ApiError(httpStatus.NOT_FOUND, res.__('user_not_found') || 'User not found');
  }
  
  if (!fullUser.salt) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, res.__('invalid_user_data') || 'Invalid user data');
  }
  
  // Verify current password
  const pass = await Encrypter.password_dec(current_password, fullUser.salt);
  if (pass !== fullUser.password) {
    throw new ApiError(httpStatus.FORBIDDEN, res.__('incorrect_current_password') || 'Current password is incorrect');
  }
  
  // Check if new password matches confirmation
  if (new_password !== confirm_password) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('password_not_match'));
  }
  
  // Encrypt new password
  const newPass = await Encrypter.password_enc(new_password);
  
  // Update password
  await fullUser.update({
    password: newPass.encr,
    salt: newPass.salt,
  });
  
  return true;
};

/**
 * Generate password reset code (no email)
 */
const forgotPassword = async (email, res) => {
  const user = await checkUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, res.__('user_not_found') || 'User not found');
  }
  
  // Generate 6-digit reset code
  const resetCode = crypto.randomInt(100000, 999999).toString();
  const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store reset code and expiry in user record
  await user.update({
    reset_code: resetCode,
    reset_code_expiry: resetCodeExpiry,
  });
  
  // In a real application, you would send this code via SMS or show it to admin
  // For now, we'll return it (ONLY FOR DEVELOPMENT)
  return resetCode;
};

/**
 * Reset password using reset code
 */
const resetPassword = async (body, res) => {
  const { email, reset_code, new_password, confirm_password } = body;
  
  const user = await checkUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, res.__('user_not_found') || 'User not found');
  }
  
  // Check if reset code exists and matches
  if (!user.reset_code || user.reset_code !== reset_code) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('invalid_reset_code') || 'Invalid reset code');
  }
  
  // Check if reset code has expired
  if (!user.reset_code_expiry || new Date() > user.reset_code_expiry) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('reset_code_expired') || 'Reset code has expired');
  }
  
  // Check if passwords match
  if (new_password !== confirm_password) {
    throw new ApiError(httpStatus.BAD_REQUEST, res.__('password_not_match'));
  }
  
  // Encrypt new password
  const newPass = await Encrypter.password_enc(new_password);
  
  // Update password and clear reset code
  await user.update({
    password: newPass.encr,
    salt: newPass.salt,
    reset_code: null,
    reset_code_expiry: null,
  });
  
  return true;
};

module.exports = {
  signUp,
  signIn,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};