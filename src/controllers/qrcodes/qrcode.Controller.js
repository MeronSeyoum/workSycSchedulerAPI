const { QRCode: QRCodeModel, Client } = require('../../models');
const QRCodeGenerator = require('qrcode');
const { Op } = require('sequelize');
const logger = require('../../config/logger');

// Helper function to generate QR code image
const generateQRCodeImage = async (text) => {
  try {
    return await QRCodeGenerator.toDataURL(text);
  } catch (err) {
    logger.error('QR Code generation failed:', err);
    throw new Error('Failed to generate QR code');
  }
};

// Helper function to build where condition for QR codes
const buildQRCodeWhereCondition = (params = {}) => {
  const {
    client_id,
    include_expired = false,
    active_only = false
  } = params;

  const where = {};
  
  if (client_id) {
    where.client_id = client_id;
  }

  if (!include_expired && active_only) {
    where[Op.or] = [
      { expires_at: { [Op.gt]: new Date() } },
      { expires_at: null }
    ];
  }

  return where;
};

module.exports = {
  // Create a new QR code for a client
  async createQRCode(req, res) {
    try {
      const { client_id, expires_at } = req.body;
      
      // Verify client exists
      const client = await Client.findByPk(client_id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Generate a unique code value
      const code_value = `CLIENT-${client_id}-${Date.now()}`;
      
      // Generate QR code image
      const qrCodeImage = await generateQRCodeImage(code_value);
      
      // Create QR code record
      const qrCode = await QRCodeModel.create({
        client_id,
        code_value,
        expires_at: expires_at ? new Date(expires_at) : null,
      });
      
      res.status(201).json({
        ...qrCode.toJSON(),
        qr_code_image: qrCodeImage,
        client: client.toJSON()
      });
    } catch (error) {
      logger.error('Create QR Code Error:', error);
      res.status(400).json({ 
        error: 'Failed to create QR code',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get all QR codes with pagination and filtering
  async getAllQRCodes(req, res) {
    const { 
      page = 1, 
      limit = 10, 
      include_expired = 'false',
      client_id 
    } = req.query;
//   include_expired = 'false', is active only active qrcode code that hasn't expired will be send to frontend
    try {
      const whereCondition = buildQRCodeWhereCondition({
        client_id,
        include_expired: include_expired === 'true'
      });

      const { count, rows } = await QRCodeModel.findAndCountAll({
        where: whereCondition,
        include: [{
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email', 'contact_person', 'location_address']
        }],
        order: [['created_at', 'DESC']],
        offset: (page - 1) * limit,
        limit: parseInt(limit),
      });

      res.json({
        data: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Failed to fetch QR codes:', error);
      res.status(500).json({ 
        error: 'Failed to fetch QR codes',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get QR codes by client ID
  async getQRCodesByClient(req, res) {
    try {
      const { client_id } = req.params;
      const { include_expired = 'false' } = req.query;
      
      const whereCondition = buildQRCodeWhereCondition({
        client_id,
        include_expired: include_expired === 'true'
      });
      
      const qrCodes = await QRCodeModel.findAll({
        where: whereCondition,
        include: [{
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email']
        }]
      });
      
      res.json(qrCodes);
    } catch (error) {
      logger.error('Get QR Codes By Client Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch QR codes',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get QR code by ID with client info
  async getQRCodeById(req, res) {
    try {
      const { id } = req.params;
      
      const qrCode = await QRCodeModel.findByPk(id, {
        include: [{
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email']
        }]
      });
      
      if (!qrCode) {
        return res.status(404).json({ error: 'QR code not found' });
      }
      
      res.json(qrCode);
    } catch (error) {
      logger.error('Get QR Code By ID Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch QR code',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Update QR code expiration
  async updateQRCode(req, res) {
    try {
      const { id } = req.params;
      const { expires_at } = req.body;
      
      if (!expires_at) {
        return res.status(400).json({ error: 'Expiration date is required' });
      }
      
      const qrCode = await QRCodeModel.findByPk(id);
      if (!qrCode) {
        return res.status(404).json({ error: 'QR code not found' });
      }
      
      const newExpiry = new Date(expires_at);
      await qrCode.update({ expires_at: newExpiry });
      
      res.json(qrCode);
    } catch (error) {
      logger.error('Update QR Code Error:', error);
      res.status(500).json({ 
        error: 'Failed to update QR code',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Delete QR code
  async deleteQRCode(req, res) {
    try {
      const { id } = req.params;
      const qrCode = await QRCodeModel.findByPk(id);
      
      if (!qrCode) {
        return res.status(404).json({ error: 'QR code not found' });
      }
      
      await qrCode.destroy();
      res.status(204).end();
    } catch (error) {
      logger.error('Delete QR Code Error:', error);
      res.status(500).json({ 
        error: 'Failed to delete QR code',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Validate QR code
  async validateQRCode(req, res) {
    try {
      const { code_value } = req.body;
      
      if (!code_value) {
        return res.status(400).json({ error: 'QR code value is required' });
      }
      
      const qrCode = await QRCodeModel.findOne({
        where: { code_value },
        include: [{
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'email']
        }]
      });
      
      if (!qrCode) {
        return res.status(404).json({ 
          valid: false, 
          error: 'QR code not found' 
        });
      }
      
      const isExpired = qrCode.expires_at && new Date(qrCode.expires_at) < new Date();
      
      res.json({ 
        valid: !isExpired,
        qr_code: qrCode,
        error: isExpired ? 'QR code has expired' : undefined
      });
    } catch (error) {
      logger.error('Validate QR Code Error:', error);
      res.status(500).json({ 
        error: 'Validation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Download QR code image
  async downloadQRCode(req, res) {
    try {
      const { id } = req.params;
      const qrCode = await QRCodeModel.findByPk(id);
      
      if (!qrCode) {
        return res.status(404).json({ error: 'QR code not found' });
      }
      
      const qrCodeImage = await generateQRCodeImage(qrCode.code_value);
      const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, 'base64');
      
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `attachment; filename=qrcode-${qrCode.code_value}.png`);
      res.send(imgBuffer);
    } catch (error) {
      logger.error('Download QR Code Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate QR code image',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};