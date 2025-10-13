// controllers/photoController.js
const cloudinary = require('cloudinary').v2;
const { ShiftPhoto, Shift, User } = require('../models');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload photo when shift is complete
exports.uploadShiftPhoto = async (req, res) => {
  try {
    const { shiftId, description } = req.body;
    const employeeId = req.user.id;
    const file = req.file;

    // Validate shift exists and belongs to employee
    const shift = await Shift.findOne({
      where: { id: shiftId, employeeId },
    });

    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Validate file
    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    if (file.size > parseInt(process.env.MAX_FILE_SIZE)) {
      return res.status(400).json({ message: 'File too large' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: `shifts/${shiftId}`,
      resource_type: 'auto',
      quality: 'auto',
      width: 1200,
      crop: 'scale',
    });

    // Create database record
    const photo = await ShiftPhoto.create({
      shiftId,
      employeeId,
      photoUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      description,
    });

    // Update shift status
    await shift.update({ status: 'completed_awaiting_review' });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

// Get photos for a shift
exports.getShiftPhotos = async (req, res) => {
  try {
    const { shiftId } = req.params;

    const photos = await ShiftPhoto.findAll({
      where: { shiftId },
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(photos);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
};

// Manager approves/rejects photo
exports.approvePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { status, comment } = req.body; // status: 'approved' or 'rejected'

    const photo = await ShiftPhoto.findByPk(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    await photo.update({
      managerApprovalStatus: status,
      managerApprovedAt: new Date(),
      managerComment: comment,
    });

    // Update shift status
    const shift = await Shift.findByPk(photo.shiftId);
    await shift.update({
      status: status === 'approved' ? 'completed' : 'completed_rejected',
    });

    res.json({
      message: `Photo ${status}`,
      photo,
    });
  } catch (error) {
    res.status(500).json({ message: 'Approval failed' });
  }
};

// Delete photo (only employee/manager)
exports.deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    const photo = await ShiftPhoto.findByPk(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Authorization check
    if (photo.employeeId !== userId && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(photo.publicId);

    // Delete from database
    await photo.destroy();

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed' });
  }
};