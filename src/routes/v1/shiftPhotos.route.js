// routes/shift-photos.route.js
const express = require('express');
const { shiftPhotoValidation } = require('../../validations');
const shiftPhotoController = require('../../controllers/task/shiftPhoto.controller');
const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');
const { uploadSingle } = require('../../middlewares/upload.middleware'); // ✅ Import multer middleware

const router = express.Router();

console.log("shift-photos routes loaded");

// GET routes
router.get('/', authVerify, validate(shiftPhotoValidation.getPhotos), shiftPhotoController.getAll);
router.get('/:id', authVerify, validate(shiftPhotoValidation.byId), shiftPhotoController.getById);

// POST route with file upload middleware
// ✅ IMPORTANT: uploadSingle MUST come before validation
router.post('/', 
  authVerify, 
  uploadSingle, // ✅ Handles multipart/form-data and file upload
  validate(shiftPhotoValidation.create), // ⚠️ You may need to update validation to handle file uploads
  shiftPhotoController.create
);

// UPDATE routes
router.patch('/:id/approval', authVerify, validate(shiftPhotoValidation.updateApproval), shiftPhotoController.updateApproval);
router.post('/bulk-approval', authVerify, shiftPhotoController.bulkUpdateApproval);

// DELETE route
router.delete('/:id', authVerify, validate(shiftPhotoValidation.byId), shiftPhotoController.delete);

module.exports = router;