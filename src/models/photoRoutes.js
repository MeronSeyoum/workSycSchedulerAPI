// routes/photoRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const photoController = require('../controllers/photoController');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_IMAGE_TYPES.split(',');
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) },
});

// Photo routes
router.post(
  '/upload',
  authenticate,
  authorize('employee'),
  upload.single('photo'),
  photoController.uploadShiftPhoto
);

router.get(
  '/shift/:shiftId',
  authenticate,
  photoController.getShiftPhotos
);

router.put(
  '/:photoId/approve',
  authenticate,
  authorize('manager'),
  photoController.approvePhoto
);

router.delete(
  '/:photoId',
  authenticate,
  photoController.deletePhoto
);

// Complaint routes
router.post(
  '/complaints/file',
  authenticate,
  authorize('client'),
  complaintController.fileComplaint
);

router.get(
  '/:photoId/complaints',
  authenticate,
  complaintController.getPhotoComplaints
);

router.put(
  '/complaints/:complaintId',
  authenticate,
  authorize('manager'),
  complaintController.resolveComplaint
);

router.get(
  '/complaints/dashboard',
  authenticate,
  authorize('manager'),
  complaintController.getComplaintsDashboard
);

module.exports = router;