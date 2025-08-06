// src/routes/v1/shift.route.js
const express = require('express');
const { shiftValidation } = require('../../validations');
const shiftController = require('../../controllers/shift/shift.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

// GET Routes
router.get('/', authVerify, shiftController.getAll);
router.get('/employee/:employeeId', authVerify, shiftController.getByEmployee);
router.get('/client/:clientId', authVerify, shiftController.getByClient);
router.get('/:id', authVerify, shiftController.getById);

// POST Routes
router.post('/', authVerify, validate(shiftValidation.createShiftWithEmployees), shiftController.createShiftWithEmployees);
router.post('/recurring', authVerify, validate(shiftValidation.createRecurring), shiftController.createRecurring);

// PUT Routes
router.put('/:id', authVerify, validate(shiftValidation.updateShift), shiftController.updateShift);
router.put('/:id/status', authVerify, validate(shiftValidation.updateStatus), shiftController.updateStatus);

// DELETE Route
router.delete('/:id', authVerify, shiftController.delete);

// moving shift
router.post('/move', authVerify, shiftController.moveShiftToDate);
// router.post('/:shiftId/employees/:employeeId/move', authVerify, shiftController.moveEmployeeToDate);
module.exports = router;