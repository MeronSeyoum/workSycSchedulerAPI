const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { authService, tokenService } = require('../../services');

/**
 * Body
 * @param {string} req.body.first_name
 * @param {string} req.body.last_name
 * @param {string} req.body.email
 * @param {string} req.body.password
 * @param {string} req.body.password_again
 */
const signUp = catchAsync(async (req, res) => {
  const createUser = await authService.signUp(req.body, res);
  if (!createUser) throw new ApiError(httpStatus.BAD_REQUEST, res.__('something_wrong'));
  const data = {
    user: createUser,
  };
  res.status(httpStatus.CREATED).send({ message: res.__('userCreated'), data: data });
});
/**
 * Body
 * @param {string} req.body.email
 * @param {string} req.body.password
 */
const signIn = catchAsync(async (req, res) => {
  const authUser = await authService.signIn(req.body, res);
  if (!authUser) throw new ApiError(httpStatus.BAD_REQUEST, res.__('something_wrong'));
  const tokens = await tokenService.generateAuthTokens(authUser);
  const data = {
    ...tokens,
    user: authUser,
  };
  res.status(httpStatus.OK).send({ message: res.__('userSignin'), data: data });
});

const getUser = catchAsync(async (req, res) => {
  const user = req.user;
  res.status(httpStatus.OK).send({ message: res.__('userFound'), data: user });
});


const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user, req.token);
  res.status(httpStatus.OK).send({ message: res.__('logoutSuccess') });
});

/**
 * Change Password (for authenticated users)
 * @param {string} req.body.current_password
 * @param {string} req.body.new_password
 * @param {string} req.body.confirm_password
 */
const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user, req.body, res);
  res.status(httpStatus.OK).send({ message: res.__('passwordChanged') || 'Password changed successfully' });
});

/**
 * Forgot Password (generates reset code)
 * @param {string} req.body.email
 */
const forgotPassword = catchAsync(async (req, res) => {
  const resetCode = await authService.forgotPassword(req.body.email, res);
  // In development, you can return the code. In production, remove this!
  res.status(httpStatus.OK).send({ 
    message: res.__('resetCodeGenerated') || 'Password reset code generated. Please check your account.',
    // Remove the line below in production!
    data: { reset_code: resetCode } // Only for development/testing
  });
});

/**
 * Reset Password (using reset code)
 * @param {string} req.body.email
 * @param {string} req.body.reset_code
 * @param {string} req.body.new_password
 * @param {string} req.body.confirm_password
 */
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body, res);
  res.status(httpStatus.OK).send({ message: res.__('passwordReset') || 'Password has been reset successfully' });
});

module.exports = {
  signUp,
  signIn,
  getUser,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};
