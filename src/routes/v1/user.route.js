// src/routes/v1/user.route.js
const express = require('express');
const validate = require('../../middlewares/validate');
const { userValidation } = require('../../validations');
const userController = require('../../controllers/user/user.controller'); // Fixed import path
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.post('/', authVerify, validate(userValidation.createUser), userController.create);

router.get('/', authVerify, validate(userValidation.listUsers), userController.getAll);

router.get('/:userId', authVerify, validate(userValidation.getUser), userController.getById);

router.put('/:userId', authVerify, validate(userValidation.updateUser), userController.update);

router.delete('/:userId', authVerify, validate(userValidation.deleteUser), userController.deleteUser);

router.post('/:userId/reset-password', authVerify, validate(userValidation.resetPassword), userController.resetPassword);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and administration
 */

module.exports = router;
