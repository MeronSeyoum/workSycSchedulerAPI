const { ShiftPhoto, Shift, Employee, User, Task, PhotoComplaint, Client } = require('../../models');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (should be in your config file)
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

/**
 * @swagger
 * tags:
 *   name: ShiftPhotos
 *   description: Shift photo management
 */

exports.getAll = async (req, res) => {
  try {
    const photos = await ShiftPhoto.findAll({
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
            model: Client,
            as: 'client',
            attributes: ['id', 'business_name', 'email', 'contact_person']
          }]
        },
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'description', 'category']
        },
        {
          model: PhotoComplaint,
          as: 'complaints',
          include: [{
            model: Client,
            as: 'client',
            attributes: ['id', 'business_name', 'email', 'contact_person']
          }]
        }
      ],
      order: [['uploaded_at', 'DESC']]
    });

    res.json(photos);
  } catch (error) {
    console.error('Error fetching shift photos:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve shift photos',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await ShiftPhoto.findByPk(id, {
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
            model: Client,
            as: 'client',
            attributes: ['id', 'business_name', 'email', 'contact_person']
          }]
        },
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'description', 'category']
        },
        {
          model: PhotoComplaint,
          as: 'complaints',
          include: [{
            model: Client,
            as: 'client',
            attributes: ['id', 'business_name', 'email', 'contact_person']
          }]
        }
      ]
    });

    if (!photo) {
      return res.status(404).json({ message: 'Shift photo not found' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Error fetching shift photo:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve shift photo',
      error: error.message,
    });
  }
};

/**
 * ✅ UPDATED: Handle file upload from mobile app
 */
exports.create = async (req, res) => {
  try {
    console.log('Create photo request received');
    console.log('Body:', req.body);
    console.log('File:', req.file ? 'Present' : 'Not present');

    const { shift_id, employee_id, description, task_name, task_id } = req.body;

    // Check if file was uploaded (using multer or similar middleware)
    if (!req.file) {
      return res.status(400).json({ 
        message: 'Photo file is required',
        receivedFields: Object.keys(req.body)
      });
    }

    // Verify shift exists
    const shift = await Shift.findByPk(shift_id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Find employee by user_id (employee_id from frontend is actually user_id)
    const employee = await Employee.findOne({ 
      where: { user_id: employee_id },
      include: [{ model: User, as: 'user' }]
    });

    if (!employee) {
      return res.status(404).json({ 
        message: 'Employee not found for this user',
        user_id: employee_id 
      });
    }

    // ✅ Upload to Cloudinary
    let uploadResult;
    try {
      // Convert buffer to base64 data URI for Cloudinary
      const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      // uploadResult = await cloudinary.uploader.upload(fileStr, {
      //   folder: `shift-photos/${shift_id}`,
      //   resource_type: 'auto',
      //   transformation: [
      //     { width: 1200, height: 1200, crop: 'limit' },
      //     { quality: 'auto:good' }
      //   ]
      // });

      // console.log('Cloudinary upload successful:', uploadResult.public_id);
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({ 
        message: 'Failed to upload photo to cloud storage',
        error: uploadError.message
      });
    }

    // ✅ Create photo record with Cloudinary URL
    const photo = await ShiftPhoto.create({
      shift_id,
      employee_id: employee.id, // Use the actual employee ID, not user ID
      photo_url: uploadResult.secure_url || '',
      public_id: uploadResult.public_id  || '',
      description: description || null,
      custom_task_name: task_name || null,
      task_id: task_id || null,
      uploaded_at: new Date()
    });

    // Fetch the created photo with associations
    const newPhoto = await ShiftPhoto.findByPk(photo.id, {
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
          attributes: ['id', 'client_id', 'date', 'start_time', 'end_time']
        },
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'description']
        }
      ]
    });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: newPhoto
    });
  } catch (error) {
    console.error('Error creating shift photo:', error);
    res.status(500).json({ 
      message: 'Failed to create shift photo',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.updateApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { manager_approval_status, manager_comment } = req.body;

    const photo = await ShiftPhoto.findByPk(id, {
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
          attributes: ['id', 'client_id', 'date', 'start_time', 'end_time']
        }
      ]
    });

    if (!photo) {
      return res.status(404).json({ message: 'Shift photo not found' });
    }

    const updateData = {
      manager_approval_status,
      manager_comment,
      updated_at: new Date()
    };

    if (manager_approval_status === 'approved' || manager_approval_status === 'rejected') {
      updateData.manager_approved_at = new Date();
    }

    await photo.update(updateData);

    res.json({
      message: 'Photo approval status updated successfully',
      photo
    });
  } catch (error) {
    console.error('Error updating photo approval:', error);
    res.status(500).json({ 
      message: 'Failed to update photo approval',
      error: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await ShiftPhoto.findByPk(id);
    if (!photo) {
      return res.status(404).json({ message: 'Shift photo not found' });
    }

    // ✅ Delete from Cloudinary if public_id exists
    if (photo.public_id) {
      try {
        await cloudinary.uploader.destroy(photo.public_id);
        console.log('Deleted from Cloudinary:', photo.public_id);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    await photo.destroy();

    res.json({ 
      message: 'Shift photo deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting shift photo:', error);
    res.status(500).json({ 
      message: 'Failed to delete shift photo',
      error: error.message,
    });
  }
};

exports.bulkUpdateApproval = async (req, res) => {
  try {
    const { photo_ids, manager_approval_status, manager_comment } = req.body;

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return res.status(400).json({ message: 'photo_ids must be a non-empty array' });
    }

    const updateData = {
      manager_approval_status,
      manager_comment,
      updated_at: new Date()
    };

    if (manager_approval_status === 'approved' || manager_approval_status === 'rejected') {
      updateData.manager_approved_at = new Date();
    }

    const [affectedCount] = await ShiftPhoto.update(updateData, {
      where: { id: photo_ids }
    });

    const updatedPhotos = await ShiftPhoto.findAll({
      where: { id: photo_ids },
      include: [
        {
          model: Employee,
          as: 'employee',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }]
        }
      ]
    });

    res.json({
      message: `Successfully updated ${affectedCount} photos`,
      updatedPhotos
    });
  } catch (error) {
    console.error('Error bulk updating photo approvals:', error);
    res.status(500).json({ 
      message: 'Failed to bulk update photo approvals',
      error: error.message,
    });
  }
};