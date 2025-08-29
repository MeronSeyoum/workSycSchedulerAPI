const { Attendance, Employee, Shift, Client, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

exports.getRecentAttendance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required',
      });
    }

    const attendance = await Attendance.findAll({
      where: {
        clock_in_time: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      include: [
        {
          model: Employee,
          as: 'employee',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name'],
            },
          ],
          attributes: ['id', 'employee_code', 'position'],
        },
        {
          model: Shift,
          as: 'shift',
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['id', 'business_name'],
            },
          ],
          attributes: ['id', 'date', 'start_time', 'end_time', 'shift_type'],
        },
      ],
      order: [['clock_in_time', 'DESC']],
      limit: parseInt(limit),
    });

    // Transform data to ensure consistent format
    const transformedAttendance = attendance.map(record => ({
      id: record.id,
      employee_id: record.employee_id,
      clock_in_time: record.clock_in_time,
      clock_out_time: record.clock_out_time,
      hours: record.hours,
      status: record.status,
      method: record.method,
      notes: record.notes,
      employee: record.employee ? {
        id: record.employee.id,
        employee_code: record.employee.employee_code,
        position: record.employee.position,
        user: record.employee.user ? {
          id: record.employee.user.id,
          first_name: record.employee.user.first_name,
          last_name: record.employee.user.last_name,
        } : null
      } : null,
      shift: record.shift ? {
        id: record.shift.id,
        date: record.shift.date,
        start_time: record.shift.start_time,
        end_time: record.shift.end_time,
        shift_type: record.shift.shift_type,
        client: record.shift.client ? {
          id: record.shift.client.id,
          business_name: record.shift.client.business_name,
        } : null
      } : null
    }));
    res.json({
      success: true,
      data: transformedAttendance
    });
  } catch (error) {
    console.error('Error fetching recent attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent attendance',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

exports.clockIn = async (req, res) => {
  try {
    const { employeeId, method, location, qrCode } = req.body;

    // Check if employee exists and is active
    const employee = await Employee.findByPk(employeeId, {
      include: [{ model: User, where: { status: 'active' } }],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive',
      });
    }

    // Check for existing clock-in without clock-out
    const existingAttendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        clock_out_time: null,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Employee already clocked in',
        data: existingAttendance,
      });
    }

    // Create attendance record
    const attendance = await Attendance.create({
      employee_id: employeeId,
      shift_id: req.shift?.id || null,
      clock_in_time: new Date(),
      status: 'present',
      method,
      location_data: method === 'geofence' ? location : null,
      qr_code: method === 'qrcode' ? qrCode : null,
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock in',
      error: error.message,
    });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const { employeeId, method, location, qrCode } = req.body;

    // Find existing clock-in record
    const attendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        clock_out_time: null,
      },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No active clock-in found for employee',
      });
    }

    const clockOutTime = new Date();
    const hoursWorked = (clockOutTime - new Date(attendance.clock_in_time)) / (1000 * 60 * 60);

    // Update with clock-out
    await attendance.update({
      clock_out_time: clockOutTime,
      hours: Math.round(hoursWorked * 100) / 100,
      method,
      location_data: method === 'geofence' ? location : null,
      qr_code: method === 'qrcode' ? qrCode : null,
    });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock out',
      error: error.message,
    });
  }
};

exports.createManualEntry = async (req, res) => {
  try {
    const { employeeId, shiftId, clockIn, clockOut, status, method, notes, approvedById } = req.body;

    // Validate shift exists if provided
    if (shiftId) {
      const shift = await Shift.findByPk(shiftId);
      if (!shift) {
        return res.status(404).json({ 
          success: false,
          message: 'Shift not found' 
        });
      }
    }

    // Validate approver exists
    const approver = await User.findByPk(approvedById);
    if (!approver) {
      return res.status(404).json({ 
        success: false,
        message: 'Approver not found' 
      });
    }

    // Calculate hours if both clock in and out are provided
    let hours = null;
    if (clockIn && clockOut) {
      const clockInTime = new Date(clockIn);
      const clockOutTime = new Date(clockOut);
      hours = Math.round(((clockOutTime - clockInTime) / (1000 * 60 * 60)) * 100) / 100;
    }

    // Create manual attendance record
    const attendance = await Attendance.create({
      employee_id: employeeId,
      shift_id: shiftId,
      clock_in_time: clockIn,
      clock_out_time: clockOut,
      hours,
      status,
      method,
      notes,
      approved_by_id: approvedById,
      is_manual: true,
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error creating manual entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create manual entry',
      error: error.message,
    });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { employeeId, shiftId, startDate, endDate, status } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required',
      });
    }

    const where = {
      clock_in_time: {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      },
    };

    if (employeeId) where.employee_id = employeeId;
    if (shiftId) where.shift_id = shiftId;
    if (status) where.status = status;

    const attendance = await Attendance.findAll({
      where,
      include: [
        { 
          model: Employee, 
          as: 'employee',
          include: [{ model: User, as: 'user' }] 
        },
        { 
          model: Shift, 
          as: 'shift',
          include: [{ model: Client, as: 'client' }] 
        },
      ],
      order: [['clock_in_time', 'DESC']],
    });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance',
      error: error.message,
    });
  }
};

/**
 * Fetches attendance chart data with daily breakdown and summary statistics
 */
exports.fetchAttendanceChartData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Input validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required',
      });
    }

    // Get daily attendance data
    const dailyData = await Attendance.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('clock_in_time')), 'date'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('employee_id'))), 'total'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'present' THEN 1 ELSE 0 END")), 'present'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'late' THEN 1 ELSE 0 END")), 'late'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'absent' THEN 1 ELSE 0 END")), 'absent'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status IN ('present', 'late') AND status != 'late' THEN 1 ELSE 0 END")), 'onTime'],
      ],
      where: {
        clock_in_time: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      group: [sequelize.fn('DATE', sequelize.col('clock_in_time'))],
      order: [[sequelize.fn('DATE', sequelize.col('clock_in_time')), 'ASC']],
      raw: true,
    });

    // Get summary statistics
    const summary = await Attendance.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('employee_id'))), 'totalEmployees'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'present' THEN 1 ELSE 0 END")), 'totalPresent'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'late' THEN 1 ELSE 0 END")), 'totalLate'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'absent' THEN 1 ELSE 0 END")), 'totalAbsent'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status IN ('present', 'late') AND status != 'late' THEN 1 ELSE 0 END")), 'totalOnTime'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.fn('DATE', sequelize.col('clock_in_time')))), 'totalDays'],
      ],
      where: {
        clock_in_time: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      raw: true,
    });

    // Format response to match your API types
    const response = {
      success: true,
      data: {
        dailyData: dailyData.map((day) => ({
          date: format(new Date(day.date), 'yyyy-MM-dd'),
          present: Number(day.present) || 0,
          late: Number(day.late) || 0,
          absent: Number(day.absent) || 0,
          onTime: Number(day.onTime) || 0,
        })),
        summary: {
          totalPresent: Number(summary?.totalPresent) || 0,
          totalLate: Number(summary?.totalLate) || 0,
          totalAbsent: Number(summary?.totalAbsent) || 0,
          totalOnTime: Number(summary?.totalOnTime) || 0,
          totalDays: Number(summary?.totalDays) || 0,
        },
      },
    };

    console.log('Chart data response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching attendance chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance chart data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required',
      });
    }

    // Disable caching
    // res.setHeader('Cache-Control', 'no-store');

    // Get today's date
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Get week boundaries
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);

    // Get month boundaries
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Get basic status counts for the date range
    const statusCounts = await Attendance.findAll({
      where: {
        clock_in_time: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      attributes: [
        'status', 
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true,
    });

    // Get additional metrics
    const [
      clockedInToday,
      avgHoursResult,
      weeklyStats,
      monthlyStats
    ] = await Promise.all([
      // Today's present count
      Attendance.count({
        where: {
          clock_in_time: {
            [Op.between]: [todayStart, todayEnd],
          },
          status: 'present',
        },
      }),

      // Average hours worked in the date range
      Attendance.findOne({
        where: {
          clock_in_time: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          },
          clock_out_time: { [Op.ne]: null },
          hours: { [Op.ne]: null },
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('hours')), 'avgHours']
        ],
        raw: true,
      }),

      // Weekly stats
      Attendance.findAll({
        where: {
          clock_in_time: {
            [Op.between]: [weekStart, weekEnd],
          },
        },
        attributes: [
          'status', 
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true,
      }),

      // Monthly stats
      Attendance.findAll({
        where: {
          clock_in_time: {
            [Op.between]: [monthStart, monthEnd],
          },
        },
        attributes: [
          'status', 
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true,
      }),
    ]);

    // Initialize summary with all required fields
    const summary = {
      present: 0,
      late: 0,
      absent: 0,
      early: 0,
      earlyDepartures: 0,
      clockedInToday: clockedInToday || 0,
      onLeaveToday: 0, // TODO: Implement leave logic
      avgWeeklyHours: parseFloat(avgHoursResult?.avgHours) || 0,
      weeklyPresent: 0,
      weeklyLate: 0,
      monthlyWorkedDays: 0,
      monthlyAbsentDays: 0,
      monthlyLeaveDays: 0,
      timestamp: Date.now(),
    };

    // Process main status counts
    statusCounts.forEach((item) => {
      const status = item.status?.toLowerCase();
      const count = parseInt(item.count, 10) || 0;
      
      if (status === 'present') summary.present = count;
      else if (status === 'late') summary.late = count;
      else if (status === 'absent') summary.absent = count;
      else if (status === 'early') summary.early = count;
    });

    // Process weekly stats
    weeklyStats.forEach((item) => {
      const status = item.status?.toLowerCase();
      const count = parseInt(item.count, 10) || 0;
      
      if (status === 'present') summary.weeklyPresent = count;
      else if (status === 'late') summary.weeklyLate = count;
    });

    // Process monthly stats
    monthlyStats.forEach((item) => {
      const status = item.status?.toLowerCase();
      const count = parseInt(item.count, 10) || 0;
      
      if (status === 'present' || status === 'late') {
        summary.monthlyWorkedDays += count;
      } else if (status === 'absent') {
        summary.monthlyAbsentDays = count;
      }
      // monthlyLeaveDays would need separate leave tracking logic
    });

    console.log('Attendance summary:', summary);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};



/**
 * Updates or creates attendance records manually for employees who failed to clock in/out
 * Handles cases where no attendance record exists for a scheduled shift
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateManualAttendance = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { 
      employeeId, 
      shiftId, 
      clockIn, 
      clockOut, 
      status, 
      notes, 
      approvedById,
      reason 
    } = req.body;

    // Validate required fields
    if (!employeeId || !shiftId || !approvedById) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Employee ID, Shift ID, and Approver ID are required'
      });
    }

    // Validate the employee exists
    const employee = await Employee.findByPk(employeeId, { transaction });
    if (!employee) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Validate the shift exists and get shift details
    const shift = await Shift.findByPk(shiftId, { 
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts',
        where: { employee_id: employeeId }
      }],
      transaction
    });

    if (!shift) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Check if employee was actually scheduled for this shift
    const employeeShift = shift.employee_shifts.find(es => es.employee_id === employeeId);
    if (!employeeShift) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Employee was not scheduled for this shift'
      });
    }

    // Validate the approver exists
    const approver = await User.findByPk(approvedById, { transaction });
    if (!approver) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Approver not found'
      });
    }

    // Validate clock in/out times if provided
    if (clockIn && clockOut && new Date(clockIn) >= new Date(clockOut)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Clock out time must be after clock in time'
      });
    }

    // Calculate hours worked if both times are provided
    let hours = null;
    if (clockIn && clockOut) {
      const diffMs = new Date(clockOut) - new Date(clockIn);
      hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
    }

    // Determine the appropriate status if not provided
    let finalStatus = status;
    if (!status) {
      if (!clockIn && !clockOut) {
        finalStatus = 'absent';
      } else if (clockIn && !clockOut) {
        finalStatus = 'partial_attendance';
      } else {
        // Compare with scheduled shift times to determine if late/early
        const shiftDate = shift.date;
        const scheduledStart = new Date(`${shiftDate}T${shift.start_time}`);
        const scheduledEnd = new Date(`${shiftDate}T${shift.end_time}`);
        
        const clockInTime = new Date(clockIn);
        const clockOutTime = new Date(clockOut);
        
        const isLate = clockInTime > scheduledStart;
        const isEarly = clockOutTime < scheduledEnd;
        
        if (isLate && isEarly) {
          finalStatus = 'late_and_early';
        } else if (isLate) {
          finalStatus = 'late_arrival';
        } else if (isEarly) {
          finalStatus = 'early_departure';
        } else {
          finalStatus = 'present';
        }
      }
    }

    // Check for existing attendance record
    let attendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        shift_id: shiftId
      },
      transaction
    });

    if (attendance) {
      // Update existing record
      attendance = await attendance.update({
        clock_in_time: clockIn || attendance.clock_in_time,
        clock_out_time: clockOut || attendance.clock_out_time,
        hours: hours !== null ? hours : attendance.hours,
        status: finalStatus,
        method: 'manual',
        notes: notes || attendance.notes,
        approved_by_id: approvedById,
        is_manual: true
      }, { transaction });
    } else {
      // Create new manual attendance record
      attendance = await Attendance.create({
        employee_id: employeeId,
        shift_id: shiftId,
        clock_in_time: clockIn || null,
        clock_out_time: clockOut || null,
        hours: hours,
        status: finalStatus,
        method: 'manual',
        notes: notes || `Manual entry - ${reason || 'No reason provided'}`,
        approved_by_id: approvedById,
        is_manual: true
      }, { transaction });
    }

    // Update the employee shift status based on attendance
    let shiftStatus = employeeShift.status;
    if (finalStatus === 'absent') {
      shiftStatus = 'missed';
    } else if (finalStatus === 'present' || finalStatus === 'late_arrival' || 
               finalStatus === 'early_departure' || finalStatus === 'late_and_early') {
      shiftStatus = 'completed';
    } else if (finalStatus === 'partial_attendance') {
      shiftStatus = 'in_progress';
    }

    await employeeShift.update({ status: shiftStatus }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: attendance
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error updating manual attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attendance',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};