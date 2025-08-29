const { Geofence, Client } = require('../../models');

exports.getAll = async (req, res) => {
  try {
    const geofences = await Geofence.findAll({
      include: [{
        model: Client,
        as: 'client',
        attributes: ['id', 'business_name', 'email', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(geofences);
  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve geofences',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const geofence = await Geofence.findByPk(req.params.id, {
      include: [{
        model: Client,
        as: 'client',
        attributes: ['id', 'business_name', 'email', 'status']
      }]
    });
    
    if (!geofence) {
      return res.status(404).json({ message: 'Geofence not found' });
    }

    res.json(geofence);
  } catch (error) {
    console.error('Error fetching geofence:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve geofence',
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    // Check if client exists
    const client = await Client.findByPk(req.body.client_id);
    if (!client) {
      return res.status(404).json({ 
        message: 'Client not found',
        error: `Client with ID ${req.body.client_id} does not exist`
      });
    }

    // Create geofence
    const geofence = await Geofence.create({
      client_id: req.body.client_id,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      radius_meters: req.body.radius_meters
    });

    // Fetch the created geofence with client data
    const createdGeofence = await Geofence.findByPk(geofence.id, {
      include: [{
        model: Client,
        as: 'client',
        attributes: ['id', 'business_name', 'email', 'status']
      }]
    });

    res.status(201).json(createdGeofence);
  } catch (error) {
    console.error('Error creating geofence:', error);
    res.status(500).json({ 
      message: 'Failed to create geofence',
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    // Find geofence
    const geofence = await Geofence.findByPk(req.params.id);
    if (!geofence) {
      return res.status(404).json({ message: 'Geofence not found' });
    }

    // Check if client exists if client_id is being updated
    if (req.body.client_id && req.body.client_id !== geofence.client_id) {
      const client = await Client.findByPk(req.body.client_id);
      if (!client) {
        return res.status(404).json({ 
          message: 'Client not found',
          error: `Client with ID ${req.body.client_id} does not exist`
        });
      }
    }

    // Update geofence
    await geofence.update({
      client_id: req.body.client_id || geofence.client_id,
      latitude: req.body.latitude || geofence.latitude,
      longitude: req.body.longitude || geofence.longitude,
      radius_meters: req.body.radius_meters || geofence.radius_meters
    });

    // Fetch the updated geofence with client data
    const updatedGeofence = await Geofence.findByPk(geofence.id, {
      include: [{
        model: Client,
        as: 'client',
        attributes: ['id', 'business_name', 'email', 'status']
      }]
    });

    res.json(updatedGeofence);
  } catch (error) {
    console.error('Error updating geofence:', error);
    res.status(500).json({ 
      message: 'Failed to update geofence',
      error: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const geofence = await Geofence.findByPk(req.params.id);
    if (!geofence) {
      return res.status(404).json({ message: 'Geofence not found' });
    }

    await geofence.destroy();

    res.json({ 
      message: 'Geofence deleted successfully',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    res.status(500).json({ 
      message: 'Failed to delete geofence',
      error: error.message,
    });
  }
};