// controllers/complaintController.js
const { PhotoComplaint, ShiftPhoto, Shift } = require('../models');

// Client files a complaint
exports.fileComplaint = async (req, res) => {
  try {
    const { photoId, reason, description } = req.body;
    const clientId = req.user.id;

    const photo = await ShiftPhoto.findByPk(photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const complaint = await PhotoComplaint.create({
      photoId,
      clientId,
      reason,
      description,
    });

    res.status(201).json({
      message: 'Complaint filed successfully',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to file complaint' });
  }
};

// Get complaints for a photo
exports.getPhotoComplaints = async (req, res) => {
  try {
    const { photoId } = req.params;

    const complaints = await PhotoComplaint.findAll({
      where: { photoId },
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch complaints' });
  }
};

// Manager resolves complaint
exports.resolveComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, resolutionNote } = req.body;

    const complaint = await PhotoComplaint.findByPk(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    await complaint.update({
      status,
      resolvedAt: status !== 'filed' ? new Date() : null,
      resolutionNote,
    });

    res.json({
      message: 'Complaint resolved',
      complaint,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resolve complaint' });
  }
};

// Manager dashboard - view all complaints
exports.getComplaintsDashboard = async (req, res) => {
  try {
    const complaints = await PhotoComplaint.findAll({
      include: [
        {
          model: ShiftPhoto,
          include: [{ model: Shift }],
        },
        {
          model: User,
          as: 'client',
          attributes: ['firstName', 'lastName', 'email'],
        },
      ],
      where: { status: 'filed' },
      order: [['createdAt', 'DESC']],
    });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard' });
  }
};