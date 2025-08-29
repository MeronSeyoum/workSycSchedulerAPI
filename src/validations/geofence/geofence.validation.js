const Joi = require('joi');

const create = {
  body: Joi.object().keys({
    client_id: Joi.number().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius_meters: Joi.number().min(50).max(5000).required()
  })
};

const update = {
  params: Joi.object().keys({
    id: Joi.number().required()
  }),
  body: Joi.object().keys({
    client_id: Joi.number().optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    radius_meters: Joi.number().min(50).max(5000).optional()
  })
};

const getById = {
  params: Joi.object().keys({
    id: Joi.number().required()
  })
};

const remove = {
  params: Joi.object().keys({
    id: Joi.number().required()
  })
};

module.exports = {
  create,
  update,
  getById,
  remove
};