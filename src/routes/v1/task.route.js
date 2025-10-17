const express = require('express');
const { taskValidation } = require('../../validations');
const taskController = require('../../controllers/task/task.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, validate(taskValidation.getTasks), taskController.getAll);
router.get('/general', authVerify, taskController.getGeneralTasks);
router.get('/client/:clientId', authVerify, taskController.getByClient);
router.get('/:id', authVerify, validate(taskValidation.byId), taskController.getById);
router.post('/', authVerify, validate(taskValidation.create), taskController.create);
router.put('/:id', authVerify, validate(taskValidation.update), taskController.update);
router.delete('/:id', authVerify, validate(taskValidation.byId), taskController.delete);

module.exports = router;