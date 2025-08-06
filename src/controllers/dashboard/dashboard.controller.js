const { Client, Shift, EmployeeShift, Employee, User, Attendance, sequelize } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

/**
 * Main dashboard controller function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required'
      });
    }

    // Fetch all data in optimized way
    const [shifts, employees, clients, stats] = await Promise.all([
      fetchShiftsWithEmployeeStatus(startDate, endDate),
      fetchAllEmployees(),
      fetchAllClients(),
      calculateDashboardStats(startDate, endDate)
    ]);

    res.json({
      success: true,
      data: {
        clients,
        employees,
        shifts,
        stats
      }
    });

  } catch (error) {
    console.error('Dashboard controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message
    });
  }
};

// =====================
// DATA FETCHING FUNCTIONS
// =====================

/**
 * Fetches shifts with employee status information
 */
async function fetchShiftsWithEmployeeStatus(startDate, endDate) {
  // First get basic shift info
  const shifts = await Shift.findAll({
    where: { date: { [Op.between]: [startDate, endDate] } },
    attributes: ['id', 'date', 'start_time', 'end_time', 'shift_type'],
    include: [{
      model: Client,
      as: 'client',
      attributes: ['id', 'business_name']
    }]
  });

  // Then get all employee shifts for these shifts
  const shiftIds = shifts.map(s => s.id);
  const employeeShifts = await EmployeeShift.findAll({
    where: { shift_id: { [Op.in]: shiftIds } },
    include: [{
      model: Employee,
      as: 'employee',
      attributes: ['id', 'position'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['first_name', 'last_name']
      }]
    }]
  });

  // Combine the data
  return shifts.map(shift => {
    const esForShift = employeeShifts
      .filter(es => es.shift_id === shift.id)
      .map(es => ({
        id: es.id,
        status: es.status,
        notes: es.notes,
        employee: {
          id: es.employee.id,
          position: es.employee.position,
          user: {
            first_name: es.employee.user.first_name,
            last_name: es.employee.user.last_name
          }
        }
      }));

    return {
      id: shift.id,
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      shift_type: shift.shift_type,
      client: shift.client,
      employeeShifts: esForShift,
      status: getOverallShiftStatus(esForShift)
    };
  });
}

/**
 * Fetches all employees with user details
 */
async function fetchAllEmployees() {
  const employees = await Employee.findAll({
    attributes: ['id', 'employee_code', 'position', 'status'],
    include: [{
      model: User,
      as: 'user',
      attributes: ['first_name', 'last_name', 'email']
    }]
  });

  return employees.map(e => ({
    id: e.id,
    code: e.employee_code,
    position: e.position,
    status: e.status,
    user: {
      first_name: e.user.first_name,
      last_name: e.user.last_name,
      email: e.user.email
    }
  }));
}

/**
 * Fetches all clients
 */
async function fetchAllClients() {
  return Client.findAll({
    attributes: ['id', 'business_name', 'email', 'phone', 'contact_person', 'status']
  });
}

// =====================
// STATISTICS FUNCTIONS
// =====================

/**
 * Calculates all dashboard statistics
 */
async function calculateDashboardStats(startDate, endDate) {
  const dateRange = { date: { [Op.between]: [startDate, endDate] } };

  const [
    employeeCounts,
    clientCounts,
    shiftCounts,
    trends,
    prevPeriodCompleted
  ] = await Promise.all([
    getEmployeeCounts(),
    getClientCounts(),
    getShiftCounts(dateRange),
    getTrendData(),
    getPrevPeriodCompletedShifts(startDate, endDate)
  ]);

  return {
    ...employeeCounts,
    ...clientCounts,
    ...shiftCounts,
    ...trends,
    prevPeriodStats: {
      completedShifts: prevPeriodCompleted
    }
  };
}

/**
 * Gets various employee counts
 */
async function getEmployeeCounts() {
  const [
    totalEmployees,
    activeEmployees,
    onLeave,
    teamLeads
  ] = await Promise.all([
    Employee.count(),
    Employee.count({ where: { status: 'active' } }),
    Employee.count({ where: { status: 'on_leave' } }),
    Employee.count({ where: { position: 'Team Lead' } })
  ]);

  return {
    totalEmployees,
    activeEmployees,
    onLeave,
    teamLeads
  };
}

/**
 * Gets client-related counts
 */
async function getClientCounts() {
  const [
    totalClients,
    activeClients
  ] = await Promise.all([
    Client.count(),
    Client.count({ where: { status: 'active' } })
  ]);

  return {
    totalClients,
    activeClients
  };
}

/**
 * Gets shift-related counts
 */
async function getShiftCounts(dateRange) {
  const [
    upcomingShifts,
    totalShifts,
    completedShifts
  ] = await Promise.all([
    Shift.count({ where: { date: { [Op.gt]: new Date() } }}),
    Shift.count({ where: dateRange }),
    Shift.count({
      where: dateRange,
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts',
        where: { status: 'completed' },
        required: true
      }]
    })
  ]);

  return {
    upcomingShifts,
    totalShifts,
    completedShifts
  };
}

/**
 * Gets trend data
 */
async function getTrendData() {
  const [
    attendanceTrend,
    statusDistribution,
    positionDistribution
  ] = await Promise.all([
    calculateAttendanceTrend(),
    getStatusDistribution(),
    getPositionDistribution()
  ]);

  return {
    attendanceTrend,
    statusDistribution,
    positionDistribution
  };
}

/**
 * Gets completed shifts from previous period
 */
async function getPrevPeriodCompletedShifts(currentStart, currentEnd) {
  const start = new Date(currentStart);
  const end = new Date(currentEnd);
  const duration = end - start;
  const prevStart = new Date(start - duration);
  const prevEnd = new Date(start);

  return Shift.count({
    where: { date: { [Op.between]: [prevStart, prevEnd] } },
    include: [{
      model: EmployeeShift,
      as: 'employee_shifts',
      where: { status: 'completed' },
      required: true
    }]
  });
}

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Determines overall shift status based on employee shifts
 */
function getOverallShiftStatus(employeeShifts = []) {
  if (employeeShifts.some(es => es.status === 'completed')) return 'completed';
  if (employeeShifts.some(es => es.status === 'in_progress')) return 'in_progress';
  if (employeeShifts.some(es => es.status === 'missed')) return 'missed';
  return 'scheduled';
}

/**
 * Calculates attendance trend data
 */
async function calculateAttendanceTrend() {
  const sixMonthsAgo = dayjs().subtract(6, 'month').toDate();
  
  const trend = await Attendance.findAll({
    attributes: [
      [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('clock_in_time')), 'month'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
      [sequelize.literal(`COUNT(CASE WHEN status = 'present' THEN 1 END)`), 'present'],
      [sequelize.literal(`COUNT(CASE WHEN status = 'absent' THEN 1 END)`), 'absent']
    ],
    where: { clock_in_time: { [Op.gte]: sixMonthsAgo } },
    group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('clock_in_time'))],
    order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('clock_in_time')), 'ASC']],
    raw: true
  });

  return trend.map(item => ({
    month: item.month,
    present: item.present,
    absent: item.absent
  }));
}

/**
 * Gets employee status distribution
 */
async function getStatusDistribution() {
  return Employee.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });
}

/**
 * Gets employee position distribution
 */
async function getPositionDistribution() {
  return Employee.findAll({
    attributes: [
      'position',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['position'],
    raw: true
  });
}

module.exports = {
  getDashboardStats
};