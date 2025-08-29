// controllers/notificationController.js
const { Notification, Employee, User, Shift, sequelize } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

// Get all notifications for user
exports.getNotifications = async (req, res) => {
  try {
    const { userId, filter = 'all', limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const where = {
      userId,
      ...(filter === 'unread' && { read: false })
    };

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employee_code'],
          include: [{
            model: User,
            as: 'user',
            attributes: ['first_name', 'last_name']
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    const totalCount = await Notification.count({ where });

    res.json({
      success: true,
      data: notifications,
      meta: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};


// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    await notification.update({ read: true });

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

// Clear all notifications
exports.clearAll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all' } = req.query;

    const where = {
      userId,
      ...(filter === 'unread' && { read: false })
    };

    await Notification.destroy({ where });

    res.json({
      success: true,
      message: 'Notifications cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear notifications',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

// Create shift assignment notification
exports.createShiftAssignmentNotification = async (employeeId, shiftId) => {
  const transaction = await sequelize.transaction();
  try {
    const employee = await Employee.findByPk(employeeId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id']
      }]
    });

    const shift = await Shift.findByPk(shiftId, {
      include: [{
        model: Client,
        as: 'client',
        attributes: ['business_name']
      }]
    });

    if (!employee || !shift) {
      throw new Error('Employee or Shift not found');
    }

    const notification = await Notification.create({
      userId: employee.user.id,
      employeeId: employee.id,
      tenantId: shift.tenantId,
      type: 'assignment',
      title: 'New Shift Assigned',
      message: `You have been assigned a shift on ${dayjs(shift.date).format('MMMM D, YYYY')} at ${shift.start_time} at ${shift.client.business_name}.`,
      relatedEntityType: 'shift',
      relatedEntityId: shift.id,
      metadata: {
        shiftId: shift.id,
        date: shift.date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        clientName: shift.client.business_name
      }
    }, { transaction });

    await transaction.commit();
    return notification;
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating shift assignment notification:', error);
    throw error;
  }
};

// Create shift update notification
exports.createShiftUpdateNotification = async (employeeId, shiftId, changes) => {
  // Similar implementation to createShiftAssignmentNotification
  // but with type 'update' and different message
};

// Create shift cancellation notification
exports.createShiftCancellationNotification = async (employeeId, shiftId) => {
  // Similar implementation with type 'cancellation'
};