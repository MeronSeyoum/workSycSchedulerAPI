// middlewares/upload.middleware.js
const multer = require('multer');

// Configure multer to use memory storage (stores file in buffer)
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Export middleware for single file upload
module.exports = {
  uploadSingle: upload.single('photo'), // 'photo' must match the FormData field name
  uploadMultiple: upload.array('photos', 10), // For multiple photos (max 10)
};