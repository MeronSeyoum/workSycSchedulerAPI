const express = require('express');
const { geofenceValidation } = require('../../validations');
const geofenceController = require('../../controllers/geofence/geofence.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, geofenceController.getAll);
router.get('/:id', authVerify, validate(geofenceValidation.getById), geofenceController.getById);
router.post('/', authVerify, validate(geofenceValidation.create), geofenceController.create);
router.put('/:id', authVerify, validate(geofenceValidation.update), geofenceController.update);
router.delete('/:id', authVerify, validate(geofenceValidation.remove), geofenceController.delete);

module.exports = router;