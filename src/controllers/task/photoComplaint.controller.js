const { PhotoComplaint, ShiftPhoto, Employee, User, Shift, Task, Client } = require('../../models'); // Added Client

/**
 * @swagger
 * tags:
 *   name: PhotoComplaints
 *   description: Photo complaint management
 */

exports.getAll = async (req, res) => {
  try {
    const { status, client_id, photo_id } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (client_id) where.client_id = client_id;
    if (photo_id) where.photo_id = photo_id;

    const complaints = await PhotoComplaint.findAll({
      where,
      include: [
        {
          model: ShiftPhoto,
          as: 'ShiftPhoto',
          include: [
            {
              model: Employee,
              as: 'employee',
              include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'email']
              }]
            },
            {
              model: Shift,
              as: 'shift',
              attributes: ['id', 'client_id', 'date', 'start_time', 'end_time'],
              include: [{
                model: Client,  // ✅ Fixed: Use Client instead of User
                as: 'client',
                attributes: ['id', 'business_name', 'email', 'contact_person']
              }]
            },
            {
              model: Task,
              as: 'task',
              attributes: ['id', 'name', 'description']
            }
          ]
        },
        {
          model: Client,  // ✅ Fixed: Use Client instead of User
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(complaints);
  } catch (error) {
    console.error('Error fetching photo complaints:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve photo complaints',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await PhotoComplaint.findByPk(id, {
      include: [
        {
          model: ShiftPhoto,
          as: 'ShiftPhoto',
          include: [
            {
              model: Employee,
              as: 'employee',
              include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'email']
              }]
            },
            {
              model: Shift,
              as: 'shift',
              attributes: ['id', 'client_id', 'date', 'start_time', 'end_time'],
              include: [{
                model: Client,  // ✅ Fixed: Use Client instead of User
                as: 'client',
                attributes: ['id', 'business_name', 'email', 'contact_person']
              }]
            },
            {
              model: Task,
              as: 'task',
              attributes: ['id', 'name', 'description']
            }
          ]
        },
        {
          model: Client,  // ✅ Fixed: Use Client instead of User
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person']
        }
      ]
    });

    if (!complaint) {
      return res.status(404).json({ message: 'Photo complaint not found' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('Error fetching photo complaint:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve photo complaint',
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const { photo_id, client_id, reason, description } = req.body;

    // Verify photo exists
    const photo = await ShiftPhoto.findByPk(photo_id);
    if (!photo) {
      return res.status(404).json({ message: 'Shift photo not found' });
    }

    // Verify client exists - now using Client model
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const complaint = await PhotoComplaint.create({
      photo_id,
      client_id,
      reason,
      description,
      status: 'filed'
    });

    // Fetch the created complaint with associations
    const newComplaint = await PhotoComplaint.findByPk(complaint.id, {
      include: [
        {
          model: ShiftPhoto,
          as: 'ShiftPhoto',
          include: [{
            model: Employee,
            as: 'employee',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email']
            }]
          }]
        },
        {
          model: Client,  // ✅ Fixed: Use Client instead of User
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person']
        }
      ]
    });

    res.status(201).json(newComplaint);
  } catch (error) {
    console.error('Error creating photo complaint:', error);
    res.status(500).json({ 
      message: 'Failed to create photo complaint',
      error: error.message,
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_note } = req.body;

    const complaint = await PhotoComplaint.findByPk(id, {
      include: [
        {
          model: ShiftPhoto,
          as: 'ShiftPhoto',
          include: [{
            model: Employee,
            as: 'employee',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email']
            }]
          }]
        },
        {
          model: Client,  // ✅ Fixed: Use Client instead of User
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person']
        }
      ]
    });

    if (!complaint) {
      return res.status(404).json({ message: 'Photo complaint not found' });
    }

    const updateData = {
      status,
      resolution_note,
      updated_at: new Date()
    };

    // Set resolved_at if status is resolved or dismissed
    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolved_at = new Date();
    }

    await complaint.update(updateData);

    res.json({
      message: 'Complaint status updated successfully',
      complaint
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ 
      message: 'Failed to update complaint status',
      error: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await PhotoComplaint.findByPk(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Photo complaint not found' });
    }

    await complaint.destroy();

    res.json({ 
      message: 'Photo complaint deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting photo complaint:', error);
    res.status(500).json({ 
      message: 'Failed to delete photo complaint',
      error: error.message,
    });
  }
};

// Get complaints by photo ID
exports.getByPhotoId = async (req, res) => {
  try {
    const { photoId } = req.params;

    const complaints = await PhotoComplaint.findAll({
      where: { photo_id: photoId },
      include: [
        {
          model: Client,  // ✅ Fixed: Use Client instead of User
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(complaints);
  } catch (error) {
    console.error('Error fetching complaints by photo:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve complaints',
      error: error.message,
    });
  }
};