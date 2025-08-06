const express = require('express');
const { clientValidation } = require('../../validations');
const clientController = require('../../controllers/client/client.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, clientController.getAll);
router.get('/nearby', authVerify, clientController.getByCoordinates);
router.get('/:id', authVerify, clientController.getById);
router.post('/', authVerify, validate(clientValidation.create), clientController.create);
router.put('/:id', authVerify, validate(clientValidation.update), clientController.update);
router.delete('/:id', authVerify, clientController.delete);

module.exports = router;
/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Client management
 */