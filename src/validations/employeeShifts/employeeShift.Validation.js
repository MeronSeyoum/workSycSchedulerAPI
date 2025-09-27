const Joi = require('joi');
const dayjs = require('dayjs');

// Helper to validate date ranges
const validateDateRange = (value, helpers) => {
  if (value && !dayjs(value).isValid()) {
    return helpers.error('date.invalid');
  }
  return value;
};

const clockInSchema = Joi.object({
  method: Joi.string()
    .valid('qr', 'mobile', 'web')
    .default('mobile')
    .description('Clock-in method used'),
    
  qr_code: Joi.string()
    .when('method', {
      is: 'qr',
      then: Joi.string().required().messages({
        'any.required': 'QR code is required when method is "qr"'
      }),
      otherwise: Joi.string().optional()
    })
    .description('QR code for verification'),
    
  notes: Joi.string()
    .allow('')
    .max(500)
    .optional()
    .description('Additional notes about the clock-in'),
    
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .precision(8)
    .optional()
    .description('Latitude coordinate for location verification'),
    
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .precision(8)
    .optional()
    .description('Longitude coordinate for location verification')
}).options({ abortEarly: false });

const clockOutSchema = Joi.object({
  method: Joi.string()
    .valid('qr', 'mobile', 'web')
    .default('mobile')
    .description('Clock-out method used'),
    
  notes: Joi.string()
    .allow('')
    .max(500)
    .optional()
    .description('Additional notes about the clock-out'),
    
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .precision(8)
    .optional()
    .description('Latitude coordinate for location verification'),
    
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .precision(8)
    .optional()
    .description('Longitude coordinate for location verification')
}).options({ abortEarly: false });

const getShiftsSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .custom(validateDateRange, 'Date validation')
    .max('now')
    .optional()
    .description('Start date for filtering shifts (YYYY-MM-DD)'),
    
  endDate: Joi.date()
    .iso()
    .custom(validateDateRange, 'Date validation')
    .min(Joi.ref('startDate'))
    .max(dayjs().add(1, 'year').toDate())
    .optional()
    .description('End date for filtering shifts (YYYY-MM-DD)')
    .when('startDate', {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref('startDate')),
      otherwise: Joi.date().optional()
    }),
    
  status: Joi.string()
    .valid('scheduled', 'completed', 'missed', 'pending', 'in_progress','draft')
    .optional()
    .description('Shift status to filter by')
}).options({ abortEarly: false });

module.exports = {
  clockInSchema,
  clockOutSchema,
  getShiftsSchema
};