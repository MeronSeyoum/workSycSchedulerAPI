// src/validations/custom.validation.js
const Joi = require('joi');

// Password validation
const password = (value, helpers) => {
  if (value.length < 8) {
    return helpers.error('any.invalid', { message: 'Password must be at least 8 characters' });
  }
  if (!/\d/.test(value) || !/[a-zA-Z]/.test(value)) {
    return helpers.error('any.invalid', { message: 'Password must contain at least 1 letter and 1 number' });
  }
  return value;
};

// ObjectId validation (for MongoDB IDs)
const objectId = (value, helpers) => {
  if (!/^[0-9a-fA-F]{24}$/.test(value)) {
    return helpers.error('any.invalid', { message: 'Invalid ID format' });
  }
  return value;
};

module.exports = {
  password,
  objectId
};

// const password = (value, helpers) => {
//   if (value.length < 8) {
//     return helpers.message('password must be at least 8 characters');
//   }
//   if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
//     return helpers.message('password must contain at least 1 letter and 1 number');
//   }
//   return value;
// };

// module.exports = {
//   password,
// };
