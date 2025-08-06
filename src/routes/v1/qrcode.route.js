const express = require('express');
const router = express.Router();
const qrcodeController = require('../../controllers/qrcodes/qrcode.Controller');
const { qrCodeValidation } = require('../../validations');

const validate = require('../../middlewares/validate');
const { authVerify } = require('../../middlewares/auth');

// Create a QR code
// router.post('/', qrcodeController.createQRCode);
router.post('/', authVerify, validate(qrCodeValidation.create), qrcodeController.createQRCode);

// Get all QR codes
// router.get('/', qrcodeController.getAllQRCodes);
router.get('/', authVerify, qrcodeController.getAllQRCodes);

// Get QR codes by client ID
router.get('/client/:client_id', qrcodeController.getQRCodesByClient);

// Get a specific QR code
router.get('/:id', qrcodeController.getQRCodeById);

router.get('/:id/download', qrcodeController.downloadQRCode);

// Update a QR code
router.put('/:id', qrcodeController.updateQRCode);

// Delete a QR code
router.delete('/:id', qrcodeController.deleteQRCode);

// Validate a QR code
router.post('/validate', qrcodeController.validateQRCode);

module.exports = router;