const { Attendance, Employee, Shift, Client, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { format, subDays } = require('date-fns');
exports.getRecentAttendance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
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
          as: 'employee', // Matches the association alias
          include: [
            {
              model: User,
              as: 'user', // Matches the association alias
            },
          ],
          attributes: ['id', 'employee_code', 'position'],
        },
        {
          model: Shift,
          as: 'shift', // Matches the association alias
          include: [
            {
              model: Client,
              as: 'client', // Matches the association alias
            },
          ],
          attributes: ['id', 'date', 'start_time', 'end_time'],
        },
      ],
      order: [['clock_in_time', 'DESC']],
      limit: parseInt(limit),
      raw: true, // Get plain objects
      nest: true, // Properly nest joined data
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error fetching recent attendance:', error);
    res.status(500).json({
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
        message: 'Employee not found or inactive',
      });
    }

    // Check for existing clock-in without clock-out
    const existingAttendance = await Attendance.findOne({
      where: {
        employeeId,
        clockOut: null,
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: 'Employee already clocked in',
        existingRecord: existingAttendance,
      });
    }

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId,
      shiftId: req.shift?.id || null,
      clockIn: new Date(),
      status: 'present',
      method,
      locationData: method === 'geofence' ? location : null,
      qrCode: method === 'qrcode' ? qrCode : null,
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({
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
        employeeId,
        clockOut: null,
      },
    });

    if (!attendance) {
      return res.status(404).json({
        message: 'No active clock-in found for employee',
      });
    }

    // Update with clock-out
    await attendance.update({
      clockOut: new Date(),
      method,
      locationData: method === 'geofence' ? location : null,
      qrCode: method === 'qrcode' ? qrCode : null,
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({
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
        return res.status(404).json({ message: 'Shift not found' });
      }
    }

    // Validate approver exists
    const approver = await User.findByPk(approvedById);
    if (!approver) {
      return res.status(404).json({ message: 'Approver not found' });
    }

    // Create manual attendance record
    const attendance = await Attendance.create({
      employeeId,
      shiftId,
      clockIn,
      clockOut,
      status,
      method,
      notes,
      approvedById,
      isManual: true,
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error creating manual entry:', error);
    res.status(500).json({
      message: 'Failed to create manual entry',
      error: error.message,
    });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { employeeId, shiftId, startDate, endDate, status } = req.query;

    const where = {
      clockIn: {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      },
    };

    if (employeeId) where.employeeId = employeeId;
    if (shiftId) where.shiftId = shiftId;
    if (status) where.status = status;

    const attendance = await Attendance.findAll({
      where,
      include: [
        { model: Employee, include: [User] },
        { model: Shift, include: [Client] },
      ],
      order: [['clockIn', 'DESC']],
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({
      message: 'Failed to retrieve attendance',
      error: error.message,
    });
  }
};

/**
 * Fetches attendance chart data with daily breakdown and summary statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
        [
          sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'present' THEN 1 ELSE 0 END")),
          'onTime',
        ],
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
        [
          sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'present'  THEN 1 ELSE 0 END")),
          'totalOnTime',
        ],
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
console.log(response)
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
        message: 'Both startDate and endDate are required',
      });
    }

    // Disable caching
    res.setHeader('Cache-Control', 'no-store');

    // Get today's date in YYYY-MM-DD format
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get basic status counts
    const statusCounts = await Attendance.findAll({
      where: {
        clock_in_time: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
    });

    // Get additional metrics
    const [clockedInToday, avgHoursResult] = await Promise.all([
      // Today's present count
      Attendance.count({
        where: {
          clock_in_time: {
            [Op.between]: [new Date(`${today}T00:00:00`), new Date(`${today}T23:59:59`)],
          },
          status: 'present',
        },
      }),

      // Average hours worked
      Attendance.findOne({
        where: {
          clock_in_time: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          },
          clock_out_time: { [Op.ne]: null },
        },
        attributes: [[sequelize.fn('AVG', sequelize.col('hours')), 'avgHours']],
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
      onLeaveToday: 0, // Implement your leave logic here
      avgWeeklyHours: avgHoursResult?.get('avgHours') || 0,
      weeklyPresent: 0, // Implement weekly counts
      weeklyLate: 0,
      monthlyWorkedDays: 0, // Implement monthly counts
      monthlyAbsentDays: 0,
      monthlyLeaveDays: 0,
      timestamp: Date.now(),
    };

    // Update status counts
    statusCounts.forEach((item) => {
      const status = item.get('status').toLowerCase();
      if (summary.hasOwnProperty(status)) {
        summary[status] = parseInt(item.get('count'), 10);
      }
    });
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};
