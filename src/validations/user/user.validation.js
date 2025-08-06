// src/validations/user.validation.js
const Joi = require('joi');
const { password, objectId } = require('../custom.validation'); // Make sure this path is correct

const create = {
  body: Joi.object().keys({
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password, 'password validation'),
    role: Joi.string().valid('admin', 'manager', 'employee').default('employee'),
    status: Joi.string().valid('active', 'inactive', 'suspended').default('active'),
  }),
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId, 'objectId validation'),
  }),
};

const update = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId, 'objectId validation'),
  }),
  body: Joi.object().keys({
    first_name: Joi.string().min(1).max(50),
    last_name: Joi.string().min(1).max(50),
    email: Joi.string().email(),
    role: Joi.string().valid('admin', 'manager', 'employee'),
    status: Joi.string().valid('active', 'inactive', 'suspended'),
  }),
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId, 'objectId validation'),
  }),
};

module.exports = {
  create,
  getUser,
  update,
  deleteUser,
  // ... any other exports ...
};