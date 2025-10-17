const express = require('express');
const { photoComplaintValidation } = require('../../validations');
const photoComplaintController = require('../../controllers/task/photoComplaint.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authVerify, validate(photoComplaintValidation.getComplaints), photoComplaintController.getAll);
router.get('/:id', authVerify, validate(photoComplaintValidation.byId), photoComplaintController.getById);
router.get('/photo/:photoId', authVerify, photoComplaintController.getByPhotoId);
router.post('/', authVerify, validate(photoComplaintValidation.create), photoComplaintController.create);
router.patch('/:id/status', authVerify, validate(photoComplaintValidation.updateStatus), photoComplaintController.updateStatus);
router.delete('/:id', authVerify, validate(photoComplaintValidation.byId), photoComplaintController.delete);

module.exports = router;