const Joi = require('joi');

// Base attendance fields
const baseAttendanceFields = {
  employeeId: Joi.number().integer().required(),
  shiftId: Joi.number().integer().required(),
  clockIn: Joi.date().iso().required(),
  clockOut: Joi.date().iso().greater(Joi.ref('clockIn')).optional(),
  status: Joi.string().valid('present', 'late', 'absent', 'early').required(),
  method: Joi.string().valid('geofence', 'qrcode', 'manual').required(),
  notes: Joi.string().optional().allow('')
};

// Clock in validation
const clockIn = {
  body: Joi.object({
    employeeId: Joi.number().integer().required(),
    method: Joi.string().valid('geofence', 'qrcode', 'manual').required(),
    location: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required()
    }).when('method', {
      is: 'geofence',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    qrCode: Joi.string().when('method', {
      is: 'qrcode',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// Clock out validation
const clockOut = {
  body: Joi.object({
    employeeId: Joi.number().integer().required(),
    method: Joi.string().valid('geofence', 'qrcode', 'manual').required(),
    location: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required()
    }).when('method', {
      is: 'geofence',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    qrCode: Joi.string().when('method', {
      is: 'qrcode',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// Manual entry validation
const manualEntry = {
  body: Joi.object({
    ...baseAttendanceFields,
    approvedById: Joi.number().integer().required()
  })
};

// Get attendance validation
const getAttendance = {
  query: Joi.object({
    employeeId: Joi.number().integer().optional(),
    shiftId: Joi.number().integer().optional(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    status: Joi.string().valid('present', 'late', 'absent', 'early').optional()
  })
};

const getRecentAttendance = {
  query: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    limit: Joi.number().integer().min(1).max(100).default(5)
  })
};


 const getAttendanceChartData = {
  query: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
  })
};

module.exports = {
  clockIn,
  clockOut,
  manualEntry,
  getAttendance,
  getAttendanceSummary: getAttendance,
  getRecentAttendance,
getAttendanceChartData 

};