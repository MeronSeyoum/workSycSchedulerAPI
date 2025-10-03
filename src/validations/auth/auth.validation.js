const Joi = require('joi');
const { password } = require('../custom.validation');

const signUp = {
  body: Joi.object().keys({
   first_name: Joi.string().required(),
    last_name: Joi.string().required(), 
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    password_again: Joi.string().required().custom(password),
   
  }),
};

const signIn = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
  }),
};

const getUser = {};

const changePassword = {
  body: Joi.object().keys({
    current_password: Joi.string().required(),
    new_password: Joi.string().required().custom(password),
    confirm_password: Joi.string().required().valid(Joi.ref('new_password')),
  }),
};

const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
  }),
};

const resetPassword = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    reset_code: Joi.string().required().length(6),
    new_password: Joi.string().required().custom(password),
    confirm_password: Joi.string().required().valid(Joi.ref('new_password')),
  }),
};

module.exports = {
  signUp,
  signIn,
  changePassword,
  forgotPassword,
  resetPassword,
  getUser,
};
