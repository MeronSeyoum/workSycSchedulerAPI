const Joi = require('joi');

// Address sub-schema (for billing_address)
const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postal_code: Joi.string().required(),
  country: Joi.string().required()
});

// Base client fields
const baseClientFields = {
  business_name: Joi.string().required().max(255),
    email: Joi.string().email().required(),
  phone: Joi.string().optional().allow(''),
  contact_person: Joi.string().optional().allow(''),
  location_address: addressSchema.required(),
  // geo_latitude: Joi.number().required(),
  // geo_longitude: Joi.number().required(),
  notes: Joi.string().optional().allow(''),
    status: Joi.string().valid('active', 'inactive', 'on_hold').default('active')
};

// Create validation
const create = {
  body: Joi.object({
    ...baseClientFields,
    id: Joi.forbidden() // Explicitly forbid id in create
  })
};

// Update validation
const update = {
  body: Joi.object({
    ...baseClientFields,
    id: Joi.forbidden() // ID should come from URL params only
  }),
  params: Joi.object({
    id: Joi.number().integer().required() // Require ID in URL params
  })
};

// Delete validation (just params)
const remove = {
  params: Joi.object({
    id: Joi.number().integer().required()
  })
};

module.exports = { create, update, remove };