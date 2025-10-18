const multer = require('multer');

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter - accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

module.exports = {
  uploadSingle: upload.single('photo'),
  uploadMultiple: upload.array('photos', 10),
};