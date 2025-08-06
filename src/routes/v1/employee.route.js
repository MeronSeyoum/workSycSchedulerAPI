const express = require('express');
const { employeeValidation } = require('../../validations');
const employeeController = require('../../controllers/employee/employee.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, employeeController.getAll);
router.post('/', authVerify, validate(employeeValidation.create), employeeController.create);
router.put('/:id', authVerify, validate(employeeValidation.update), employeeController.update);
router.delete('/:id', authVerify, employeeController.remove);

module.exports = router;
/**
 * @swagger
 * tags:
 *   name: Employees
 *   description: Employee management
 */