const { Task, Client, User, ShiftPhoto } = require('../../models');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management
 */

exports.getAll = async (req, res) => {
  try {
    const { category, client_id, status, requires_photo, client_specific } = req.query;
    const where = {};
    
    if (category) where.category = category;
    if (client_id) where.client_id = client_id;
    if (status) where.status = status;
    if (requires_photo !== undefined) where.requires_photo = requires_photo === 'true';
    if (client_specific !== undefined) where.client_specific = client_specific === 'true';

    const tasks = await Task.findAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve tasks',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: ShiftPhoto,
          as: 'shift_photos',
          include: ['employee', 'shift']
        }
      ]
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve task',
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      estimated_time_minutes,
      requires_photo,
      sample_photo_url,
      instructions,
      client_specific,
      client_id,
      priority,
      tags
    } = req.body;

    // Verify client exists if client_specific is true
    if (client_specific && client_id) {
      const client = await Client.findByPk(client_id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    const task = await Task.create({
      name,
      description,
      category,
      estimated_time_minutes,
      requires_photo: requires_photo !== false, // Default to true
      sample_photo_url,
      instructions,
      client_specific: client_specific || false,
      client_id: client_specific ? client_id : null,
      priority: priority || 'medium',
      tags: tags || [],
      created_by: req.user.id
    });

    // Fetch the created task with associations
    const newTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Client,
          as: 'client'
        },
        {
          model: User,
          as: 'creator'
        }
      ]
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      message: 'Failed to create task',
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify client exists if updating to client_specific
    if (updateData.client_specific && updateData.client_id) {
      const client = await Client.findByPk(updateData.client_id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    await task.update(updateData);

    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client'
        },
        {
          model: User,
          as: 'creator'
        }
      ]
    });

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      message: 'Failed to update task',
      error: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if task has associated photos
    const photoCount = await ShiftPhoto.count({ where: { task_id: id } });
    if (photoCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete task with associated photos',
        photo_count: photoCount
      });
    }

    await task.destroy();

    res.json({ 
      message: 'Task deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      message: 'Failed to delete task',
      error: error.message,
    });
  }
};

// Get tasks by client
exports.getByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const tasks = await Task.findAll({
      where: {
        client_specific: true,
        client_id: clientId,
        status: 'active'
      },
      include: [
        {
          model: Client,
          as: 'client'
        }
      ],
      order: [['priority', 'DESC'], ['name', 'ASC']]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching client tasks:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve client tasks',
      error: error.message,
    });
  }
};

// Get general tasks (not client-specific)
exports.getGeneralTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        client_specific: false,
        status: 'active'
      },
      order: [['priority', 'DESC'], ['name', 'ASC']]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching general tasks:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve general tasks',
      error: error.message,
    });
  }
};