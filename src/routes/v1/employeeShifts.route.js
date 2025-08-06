const express = require('express');
const { employeeShiftValidation } = require('../../validations');
const employeeShiftController = require('../../controllers/employeeShift/employeeShift.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, validate(employeeShiftValidation.getShifts), employeeShiftController.getEmployeeShifts);
router.get('/:shiftId', authVerify, employeeShiftController.getShiftDetails);
router.post('/:shiftId/clock-in', authVerify, validate(employeeShiftValidation.clockIn), employeeShiftController.clockIn);
router.post('/:shiftId/clock-out', authVerify, validate(employeeShiftValidation.clockOut), employeeShiftController.clockOut);
router.get('/:shiftId/qrcode', authVerify, employeeShiftController.getShiftQrCode);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: EmployeeShifts
 *   description: Employee shift management
 */