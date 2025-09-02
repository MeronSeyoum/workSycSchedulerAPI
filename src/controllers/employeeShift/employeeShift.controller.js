const { Shift, EmployeeShift, Attendance, Client, Employee, QRCode, sequelize } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);


/**
 * Calculates the appropriate attendance status based on clock-in/out times and shift schedule
 * @param {Date} clockInTime - Employee's clock-in time
 * @param {Date|null} clockOutTime - Employee's clock-out time (null if not clocked out yet)
 * @param {Shift|null} shift - The scheduled shift details (null if no shift assigned)
 * @returns {string} - Appropriate attendance status
 */
const calculateAttendanceStatus = (clockInTime, clockOutTime, shift) => {
  if (!shift) return 'present';
  
  // Convert to Date objects if they aren't already
  const clockIn = new Date(clockInTime);
  const clockOut = clockOutTime ? new Date(clockOutTime) : null;
  
  // Create shift times in UTC to avoid timezone issues
  const shiftStart = new Date(`${shift.date}T${shift.start_time}:00Z`);
  const shiftEnd = new Date(`${shift.date}T${shift.end_time}:00Z`);
  
  const lateThreshold = 15 * 60 * 1000; // 15 minutes
  const earlyDepartureThreshold = 30 * 60 * 1000; // 30 minutes
  
  const clockInTimeMs = clockIn.getTime();
  const clockOutTimeMs = clockOut ? clockOut.getTime() : null;
  
  // Check if clock-in is outside shift boundaries
  if (clockInTimeMs < shiftStart.getTime() - (60 * 60 * 1000)) { // 1 hour early
    return 'too_early';
  }
  
  if (clockInTimeMs > shiftEnd.getTime()) { // After shift ended
    return 'too_late';
  }
  
  // Check late arrival
  const isLate = clockInTimeMs > shiftStart.getTime() + lateThreshold;
  
  if (!clockOut) {
    return isLate ? 'late_arrival' : 'present';
  }
  
  // Check early departure
  const isEarlyDeparture = clockOutTimeMs < shiftEnd.getTime() - earlyDepartureThreshold;
  
  // Validate clock-out isn't before clock-in
  if (clockOutTimeMs <= clockInTimeMs) {
    return 'invalid_times';
  }
  
  // Check if clock-out is after shift end (overtime)
  const isOvertime = clockOutTimeMs > shiftEnd.getTime() + (30 * 60 * 1000);
  
  if (isLate && isEarlyDeparture) return 'late_and_early';
  if (isLate) return 'late_arrival';
  if (isEarlyDeparture) return 'early_departure';
  if (isOvertime) return 'overtime';
  
  return 'present';
};

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

// exports.clockIn = async (req, res) => {
//   const transaction = await sequelize.transaction();
//   console.log("the clockin process has started")
//   try {
//     const employeeId = await getEmployeeId(req.user.id);
//     const { shiftId } = req.params;
//     const { method = 'qrcode', qrcode, notes
//       // , latitude, longitude 
//     } = req.body;

//     // Verify shift assignment
//     const employeeShift = await EmployeeShift.findOne({
//       where: {
//         employee_id: employeeId,
//         shift_id: shiftId,
//         status: 'scheduled'
//       },
//       transaction
//     });

//     if (!employeeShift) {
//       throw new Error('Shift not available for clock-in');
//     }

//     // Check if already clocked in
//     const existingAttendance = await Attendance.findOne({
//       where: {
//         employee_id: employeeId,
//         shift_id: shiftId
//       },
//       transaction
//     });

//     if (existingAttendance?.clock_in_time) {
//       throw new Error('Already clocked in for this shift');
//     }

//     // QR code verification if provided
//     if (qrcode) {
//       const qrCode = await QRCode.findOne({
//         where: {
//           shift_id: shiftId,
//           code_value: qrcode,
//           expires_at: { [Op.gt]: new Date() }
//         },
//         transaction
//       });

//       if (!qrCode) {
//         throw new Error('Invalid or expired QR code');
//       }
//     }

//     // Create or update attendance record
//     const attendanceData = {
//       employee_id: employeeId,
//       shift_id: shiftId,
//       clock_in_time: new Date(),
//       hours: 0.0,
//       method,
//       status: 'present',
//       notes,
//       // clock_in_latitude: latitude,
//       // clock_in_longitude: longitude
//     };

//     const attendance = existingAttendance 
//       ? await existingAttendance.update(attendanceData, { transaction })
//       : await Attendance.create(attendanceData, { transaction });

//     // Update shift status
//     await employeeShift.update({ status: 'in_progress' }, { transaction });

//     await transaction.commit();

//     res.json({
//       success: true,
//       data: {
//         clock_in_time: attendance.clock_in_time,
//         status: 'in_progress'
//       }
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Error during clock in:', error);
//     const status = error.message.includes('not found') ? 404 : 400;
//     res.status(status).json({ 
//       error: error.message || 'Failed to clock in',
//       details: process.env.NODE_ENV === 'development' ? error.stack : null
//     });
//   }
// };


exports.clockIn = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const employeeId = await getEmployeeId(req.user.id);
    const { shiftId } = req.params;
    const { method = 'qrcode', qrcode, notes } = req.body;

    // Get shift details with all necessary information
    const shift = await Shift.findOne({
      where: { id: shiftId },
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts',
        where: { employee_id: employeeId },
        required: true
      }],
      transaction
    });

    if (!shift) {
      throw new Error('Shift not found or not assigned to employee');
    }

    // Verify shift is in a clock-in-able state
    if (!['scheduled', 'in_progress'].includes(shift.employee_shifts[0].status)) {
      throw new Error('Shift is not available for clock-in');
    }

    // Check for existing attendance record
    const existingAttendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId,
        clock_out_time: null
      },
      transaction
    });

    if (existingAttendance) {
      throw new Error('Already has an active clock-in for this shift');
    }

    // QR code verification if provided
    if (method === 'qrcode' && qrcode) {
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

    // Calculate status based on current time and shift schedule
    const now = new Date();
    const status = calculateAttendanceStatus(now, null, shift);

// TODO: for testing purpose disable this validation

// Validate clock-in time is within reasonable bounds
// const shiftStart = new Date(`${shift.date}T${shift.start_time}:00Z`);
// const shiftEnd = new Date(`${shift.date}T${shift.end_time}:00Z`);

// // Don't allow clock-in more than 1 hour early
// if (now.getTime() < shiftStart.getTime() - (60 * 60 * 1000)) {
//   throw new Error('Cannot clock in more than 1 hour before shift start');
// }

// // Don't allow clock-in after shift end
// if (now.getTime() > shiftEnd.getTime()) {
//   throw new Error('Cannot clock in after shift has ended');
// }
    
    // Create attendance record
    const attendance = await Attendance.create({
      employee_id: employeeId,
      shift_id: shiftId,
      clock_in_time: now,
      hours: 0.0,
      method,
      status,
      notes,
      // Include location data if available
      // clock_in_latitude: latitude,
      // clock_in_longitude: longitude
    }, { transaction });

    // Update shift status to in_progress if it was scheduled
    if (shift.employee_shifts[0].status === 'scheduled') {
      await EmployeeShift.update(
        { status: 'in_progress' },
        { 
          where: { 
            employee_id: employeeId, 
            shift_id: shiftId 
          },
          transaction
        }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        clock_in_time: attendance.clock_in_time,
        status: attendance.status,
        shift_status: 'in_progress'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error during clock in:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false,
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
    const { method = 'qrcode', notes } = req.body;

    // Get shift details with all necessary information
    const shift = await Shift.findOne({
      where: { id: shiftId },
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts',
        where: { 
          employee_id: employeeId,
          status: 'in_progress' // Only allow clock-out from in-progress shifts
        },
        required: true
      }],
      transaction
    });

    if (!shift) {
      throw new Error('No active shift found to clock out');
    }

    // Get existing attendance record
    const attendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId,
        clock_in_time: { [Op.ne]: null },
        clock_out_time: null // Ensure we only find open attendance records
      },
      transaction
    });

    if (!attendance) {
      throw new Error('No active clock-in record found for this shift');
    }

    // Calculate hours worked and determine final status
    const clockOutTime = new Date();
    const hoursWorked = (clockOutTime - attendance.clock_in_time) / (1000 * 60 * 60);
    const finalStatus = calculateAttendanceStatus(
      attendance.clock_in_time,
      clockOutTime,
      shift
    );

// TODO: disable clock-out time validation and check to see if it necessary

    // Validate clock-out time is reasonable
// if (clockOutTime <= attendance.clock_in_time) {
//   throw new Error('Clock-out time cannot be before clock-in time');
// }

// // Optional: Allow some grace period after shift end
// const shiftEnd = new Date(`${shift.date}T${shift.end_time}:00Z`);
// if (clockOutTime > shiftEnd.getTime() + (4 * 60 * 60 * 1000)) { // 4 hours max overtime
//   throw new Error('Clock-out time is unreasonably late');
// }

    // Update attendance record
    await attendance.update({
      clock_out_time: clockOutTime,
      hours: parseFloat(hoursWorked.toFixed(2)), // Store with 2 decimal places
      status: finalStatus,
      method,
      notes,
      // Include location data if available
      // clock_out_latitude: latitude,
      // clock_out_longitude: longitude
    }, { transaction });

    // Update shift status to completed
    await EmployeeShift.update(
      { status: 'completed' },
      { 
        where: { 
          employee_id: employeeId, 
          shift_id: shiftId 
        },
        transaction
      }
    );

    await transaction.commit();

    res.json({
      success: true,
      data: {
        clock_in_time: attendance.clock_in_time,
        clock_out_time: clockOutTime,
        hours_worked: parseFloat(hoursWorked.toFixed(2)),
        status: finalStatus,
        shift_status: 'completed'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error during clock out:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false,
      error: error.message || 'Failed to clock out',
      details: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

// exports.clockOut = async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const employeeId = await getEmployeeId(req.user.id);
//     const { shiftId } = req.params;
//     const { method = 'qrcode', notes, 
//       // latitude, longitude 
//       } = req.body;
//     // Verify shift is in progress
//     const employeeShift = await EmployeeShift.findOne({
//       where: {
//         employee_id: employeeId,
//         shift_id: shiftId,
//         status: 'in_progress'
//       },
//       transaction
//     });
//     if (!employeeShift) {
//       throw new Error('No active shift found to clock out');
//     }

//     // Get existing attendance record
//     const attendance = await Attendance.findOne({
//       where: {
//         employee_id: employeeId,
//         shift_id: shiftId,
//         clock_in_time: { [Op.ne]: null }
//       },
//       transaction
//     });

//     if (!attendance) {
//       throw new Error('No clock-in record found');
//     }

//     if (attendance.clock_out_time) {
//       throw new Error('Already clocked out for this shift');
//     }

//     // Calculate hours worked
//     const clockOutTime = new Date();
//     const hoursWorked = (clockOutTime - attendance.clock_in_time) / (1000 * 60 * 60);

//     // Update attendance record
//     await attendance.update({
//       clock_out_time: clockOutTime,
//       hours: hoursWorked,
//       status: 'present',
//       method,
//       notes,
//       // clock_out_latitude: latitude,
//       // clock_out_longitude: longitude
//     }, { transaction });

//     // Update shift status
//     await employeeShift.update({ status: 'completed' }, { transaction });

//     await transaction.commit();

//     res.json({
//       success: true,
//       data: {
//         clock_in_time: attendance.clock_in_time,
//         clock_out_time: clockOutTime,
//         hours: hoursWorked,
//         status: 'completed'
//       }
//     });
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Error during clock out:', error);
//     const status = error.message.includes('not found') ? 404 : 400;
//     res.status(status).json({ 
//       error: error.message || 'Failed to clock out',
//       details: process.env.NODE_ENV === 'development' ? error.stack : null
//     });
//   }
// };

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