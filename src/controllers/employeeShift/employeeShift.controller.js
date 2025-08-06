const { Shift, EmployeeShift, Attendance, Client, Employee, QRCode, sequelize } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// Helper to format shift response
const formatShiftResponse = (shift) => {
  return {
    id: shift.id,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    shift_type: shift.shift_type,
    status: shift.employee_shifts[0].status,
    notes: shift.notes,
    client: {
      id: shift.client.id,
      business_name: shift.client.business_name,
      location_address: shift.client.location_address,
    },
    qrcode: shift.client.qrcode ? {
      code_value: shift.client.qrcode.code_value,
      expires_at: shift.client.qrcode.expires_at,
      is_valid: new Date() < new Date(shift.client.qrcode.expires_at)
    } : null,
    attendance: shift.attendances?.[0] || null
  };
};

// Get employee ID from user ID
const getEmployeeId = async (userId) => {
  const employee = await Employee.findOne({
    where: { user_id: userId },
    attributes: ['id']
  });
  if (!employee) throw new Error('Employee not found for user');
  return employee.id;
};

exports.getEmployeeShifts = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { startDate, endDate, status } = req.query;

    const where = {
      '$employee_shifts.employee_id$': employeeId
    };

    if (startDate && endDate) {
      where.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    if (status) {
      where['$employee_shifts.status$'] = status;
    }

    const shifts = await Shift.findAll({
      where,
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          where: { employee_id: employeeId },
          required: true
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'location_address'],
          include: [{
            model: QRCode,
            as: 'qrcode',  // Matches the hasOne association name
            attributes: ['code_value', 'expires_at'],
            required: false
          }]
        },
        {
          model: Attendance,
          as: 'attendances',
          where: { employee_id: employeeId },
          required: false,
          separate: true  // Important for hasMany relationship
        }
      ],
      order: [
        ['date', 'ASC'],
        ['start_time', 'ASC']
      ]
    });

    const formattedShifts = shifts.map(shift => {
      const plainShift = shift.get({ plain: true });
      return {
        id: plainShift.id,
        date: plainShift.date,
        startTime: plainShift.start_time,
        endTime: plainShift.end_time,
        shift_type: plainShift.shift_type,
        status: plainShift.employee_shifts[0].status,
        notes: plainShift.notes,
        client: {
          id: plainShift.client.id,
          business_name: plainShift.client.business_name,
          location_address: plainShift.client.location_address
        },
        qrcode: plainShift.client.qrcode ? {
          code_value: plainShift.client.qrcode.code_value,
          expires_at: plainShift.client.qrcode.expires_at,
          is_valid: new Date() < new Date(plainShift.client.qrcode.expires_at)
        } : null,
        attendance: plainShift.attendances?.[0] || null
      };
    });
    console.log(formattedShifts)
    res.json({
      success: true,
      data: formattedShifts
    });

  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ 
      success: false,
      error: error.message || 'Failed to fetch shifts',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

exports.getShiftDetails = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { shiftId } = req.params;

    const shift = await Shift.findOne({
      where: { id: shiftId },
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          where: { employee_id: employeeId },
          required: true
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name', 'location_address']
        },
        {
          model: QRCode,
          as: 'qrcode',
          attributes: ['code_value', 'expires_at']
        },
        {
          model: Attendance,
          as: 'attendances',
          where: { employee_id: employeeId },
          required: false
        }
      ]
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json({
      success: true,
      data: formatShiftResponse(shift)
    });
  } catch (error) {
    console.error('Error fetching shift details:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ 
      error: error.message || 'Failed to fetch shift details',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

exports.clockIn = async (req, res) => {
  const transaction = await sequelize.transaction();
  console.log("the clockin process has started")
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { shiftId } = req.params;
    const { method = 'qrcode', qrcode, notes
      // , latitude, longitude 
    } = req.body;

    // Verify shift assignment
    const employeeShift = await EmployeeShift.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId,
        status: 'scheduled'
      },
      transaction
    });

    if (!employeeShift) {
      throw new Error('Shift not available for clock-in');
    }

    // Check if already clocked in
    const existingAttendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId
      },
      transaction
    });

    if (existingAttendance?.clock_in_time) {
      throw new Error('Already clocked in for this shift');
    }

    // QR code verification if provided
    if (qrcode) {
      const qrCode = await QRCode.findOne({
        where: {
          shift_id: shiftId,
          code_value: qrcode,
          expires_at: { [Op.gt]: new Date() }
        },
        transaction
      });

      if (!qrCode) {
        throw new Error('Invalid or expired QR code');
      }
    }

    // Create or update attendance record
    const attendanceData = {
      employee_id: employeeId,
      shift_id: shiftId,
      clock_in_time: new Date(),
      hours: 0.0,
      method,
      status: 'present',
      notes,
      // clock_in_latitude: latitude,
      // clock_in_longitude: longitude
    };

    const attendance = existingAttendance 
      ? await existingAttendance.update(attendanceData, { transaction })
      : await Attendance.create(attendanceData, { transaction });

    // Update shift status
    await employeeShift.update({ status: 'in_progress' }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: {
        clock_in_time: attendance.clock_in_time,
        status: 'in_progress'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error during clock in:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      error: error.message || 'Failed to clock in',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

exports.clockOut = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { shiftId } = req.params;
    const { method = 'qrcode', notes, 
      // latitude, longitude 
      } = req.body;
    // Verify shift is in progress
    const employeeShift = await EmployeeShift.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId,
        status: 'in_progress'
      },
      transaction
    });
    if (!employeeShift) {
      throw new Error('No active shift found to clock out');
    }

    // Get existing attendance record
    const attendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId,
        clock_in_time: { [Op.ne]: null }
      },
      transaction
    });

    if (!attendance) {
      throw new Error('No clock-in record found');
    }

    if (attendance.clock_out_time) {
      throw new Error('Already clocked out for this shift');
    }

    // Calculate hours worked
    const clockOutTime = new Date();
    const hoursWorked = (clockOutTime - attendance.clock_in_time) / (1000 * 60 * 60);

    // Update attendance record
    await attendance.update({
      clock_out_time: clockOutTime,
      hours: hoursWorked,
      status: 'present',
      method,
      notes,
      // clock_out_latitude: latitude,
      // clock_out_longitude: longitude
    }, { transaction });

    // Update shift status
    await employeeShift.update({ status: 'completed' }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: {
        clock_in_time: attendance.clock_in_time,
        clock_out_time: clockOutTime,
        hours: hoursWorked,
        status: 'completed'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error during clock out:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      error: error.message || 'Failed to clock out',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

exports.getShiftQrCode = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { shiftId } = req.params;

    // Verify shift assignment
    const employeeShift = await EmployeeShift.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId
      }
    });

    if (!employeeShift) {
      throw new Error('Shift not assigned to employee');
    }

    // Get QR code
    const qrCode = await QRCode.findOne({
      where: {
        shift_id: shiftId,
        expires_at: { [Op.gt]: new Date() }
      }
    });

    if (!qrCode) {
      throw new Error('No valid QR code found for this shift');
    }

    res.json({
      success: true,
      data: {
        code_value: qrCode.code_value,
        expires_at: qrCode.expires_at,
        is_valid: true
      }
    });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ 
      error: error.message || 'Failed to fetch QR code',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};