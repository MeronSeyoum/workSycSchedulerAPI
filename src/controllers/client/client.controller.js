const { Client } = require('../../models');
const { clientValidation } = require('../../validations');

exports.getAll = async (req, res) => {
  try {
    const { type, client_type, status } = req.query;
    const where = {};
    
    if (type) where.type = type;
    if (client_type) where.client_type = client_type;
    if (status) where.status = status;

    const clients = await Client.findAll({ 
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve clients',
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { error } = clientValidation.remove.params.validate(req.params);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const client = await Client.findByPk(req.params.id);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve client',
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    // Validate request body
    const { error } = clientValidation.create.body.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check for duplicate business name (assuming it should be unique)
    const existingClient = await Client.findOne({ 
      where: { business_name: req.body.business_name } 
    });
    
    if (existingClient) {
      return res.status(400).json({ 
        message: 'Business name already in use',
        error: `The business name "${req.body.business_name}" is already registered`
      });
    }

    // Create client
    const client = await Client.create({
      business_name: req.body.business_name,
      email: req.body.email,
      phone: req.body.phone,
      contact_person: req.body.contact_person,
      location_address: req.body.location_address,
      geo_latitude: req.body.geo_latitude,
      geo_longitude: req.body.geo_longitude,
      client_type: req.body.client_type,
      service_type: req.body.service_type,
      billing_address: req.body.billing_address,
      status: req.body.status || 'active',
      note: req.body.note || '',

    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ 
      message: 'Failed to create client',
      error: error.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    // Validate params and body
    const { error: paramsError } = clientValidation.update.params.validate(req.params);
    if (paramsError) return res.status(400).json({ error: paramsError.details[0].message });

    const { error: bodyError } = clientValidation.update.body.validate(req.body);
    if (bodyError) return res.status(400).json({ error: bodyError.details[0].message });

    // Find client
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check for business name conflict if changing
    if (req.body.business_name && req.body.business_name !== client.business_name) {
      const nameExists = await Client.findOne({ 
        where: { business_name: req.body.business_name } 
      });
      if (nameExists) {
        return res.status(400).json({ 
          message: 'Business name already in use',
          error: `The business name "${req.body.business_name}" is already registered`
        });
      }
    }

    // Update client
    await client.update({
      business_name: req.body.business_name || client.business_name,
      client_type: req.body.client_type || client.client_type,
      service_type: req.body.service_type || client.service_type,
      billing_address: req.body.billing_address || client.billing_address,
      status: req.body.status || client.status,
      note: req.body.note || client.note,
    });

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ 
      message: 'Failed to update client',
      error: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    // Validate params
    const { error } = clientValidation.remove.params.validate(req.params);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Find and delete client
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    await client.destroy();

    res.json({ 
      message: 'Client deleted successfully',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ 
      message: 'Failed to delete client',
      error: error.message,
    });
  }
};

exports.getByCoordinates = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // This is a simplified approach - for production use PostGIS or similar
    const clients = await Client.findAll();
    const nearbyClients = clients.filter(client => {
      if (!client.billing_address?.latitude || !client.billing_address?.longitude) {
        return false;
      }
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(client.billing_address.latitude),
        parseFloat(client.billing_address.longitude)
      );
      return distance <= parseFloat(radius);
    });

    res.json(nearbyClients);
  } catch (error) {
    console.error('Error fetching clients by coordinates:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve clients',
      error: error.message,
    });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula implementation
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}