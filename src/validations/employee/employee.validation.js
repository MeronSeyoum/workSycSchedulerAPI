const Joi = require('joi');

const contactSchema = Joi.object({
  phone: Joi.string().optional().allow(''),
  emergencyContact: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),
});

const baseFields = {
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  employee_code: Joi.string().optional(),
  phone_number: Joi.string().optional(),
  position: Joi.string().required(),
  status: Joi.string().valid('active', 'on_leave', 'terminated', 'inactive', 'suspended').default('active'),
  hire_date: Joi.date().required(),
  termination_date: Joi.date().optional().allow(null),
  profile_image_url: Joi.string().uri().optional().allow(''),
  assigned_locations: Joi.array().items(Joi.string()).optional(),
  contact: contactSchema.optional(),
};

const create = {
  body: Joi.object(baseFields),
};

const update = {
  body: Joi.object({
    id: Joi.number().optional(), // Add this line to allow id in updates
    ...baseFields,
  }),
};
module.exports = { create, update };
