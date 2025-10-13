const { Shift, EmployeeShift, Attendance, Client, Employee, User } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// Helper: Get employee ID from user ID
const getEmployeeId = async (userId) => {
  const employee = await Employee.findOne({
    where: { user_id: userId },
    attributes: ['id'],
  });
  return employee?.id || null;
};

// Helper: Get Monday of the current week
const getMondayOfCurrentWeek = () => {
  const today = dayjs();
  return today.subtract(today.day() === 0 ? 6 : today.day() - 1, 'day').startOf('day');
};

// Helper: Get Monday of the previous week
const getMondayOfPreviousWeek = () => {
  return getMondayOfCurrentWeek().subtract(7, 'day');
};

// Dashboard Statistics
const getDashboardStats = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Get Monday of previous and current week
    const previousWeekMonday = getMondayOfPreviousWeek();
    const currentWeekMonday = getMondayOfCurrentWeek();
    const currentWeekSunday = currentWeekMonday.add(6, 'day').endOf('day');

    // Bi-weekly range: Monday of previous week to Sunday of current week
    const biWeeklyStart = previousWeekMonday.toDate();
    const biWeeklyEnd = currentWeekSunday.toDate();

    const [totalShifts, totalHours, upcomingShift] = await Promise.all([
      // Bi-weekly shifts count
      EmployeeShift.count({
        where: { employee_id: employeeId },
        include: [
          {
            model: Shift,
            as: 'shift',
            where: { 
              date: { 
                [Op.gte]: dayjs(biWeeklyStart).format('YYYY-MM-DD'),
                [Op.lte]: dayjs(biWeeklyEnd).format('YYYY-MM-DD')
              }
            },
          },
        ],
      }),

      // Bi-weekly hours
      Attendance.sum('hours', {
        where: {
          employee_id: employeeId,
          clock_out_time: { [Op.ne]: null },
          clock_in_time: { 
            [Op.gte]: biWeeklyStart,
            [Op.lte]: biWeeklyEnd
          },
        },
      }),

      getNextUpcomingShift(employeeId),
    ]);

    const chartData = await getWeeklyChartData(employeeId);

    res.json({
      success: true,
      data: {
        stats: {
          totalShifts: totalShifts || 0,
          hoursWorked: roundToDecimal(totalHours, 1),
          earnings: calculateEarnings(totalHours),
          chartData,
        },
        upcomingShift,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    handleErrorResponse(res, error);
  }
};

// Employee Profile
const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name', 'email'],
        },
      ],
      attributes: ['position', 'profile_image_url', 'hire_date'],
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({
      success: true,
      data: formatProfileData(employee),
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    handleErrorResponse(res, error);
  }
};

// Today's Shifts
const getTodaysShifts = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const today = dayjs().format('YYYY-MM-DD');
    const shifts = await Shift.findAll({
      where: { date: today },
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          where: { employee_id: employeeId },
          required: true,
        },
        {
          model: Client,
          as: 'client',
          attributes: ['business_name', 'location_address'],
        },
      ],
      order: [['start_time', 'ASC']],
    });

    res.json({
      success: true,
      data: shifts.map(formatShiftData),
    });
  } catch (error) {
    console.error("Today's shifts error:", error);
    handleErrorResponse(res, error);
  }
};

// Helper Functions
const getWeeklyChartData = async (employeeId) => {
  // Get Monday of previous week and current week
  const previousWeekMonday = getMondayOfPreviousWeek();
  const currentWeekMonday = getMondayOfCurrentWeek();
  
  // Create 14-day range starting from Monday of previous week
  const dateRanges = Array.from({ length: 14 }, (_, i) => {
    const date = previousWeekMonday.add(i, 'day');
    return {
      start: date.startOf('day').toDate(),
      end: date.endOf('day').toDate(),
      dateString: date.format('YYYY-MM-DD'),
    };
  });

  const chartData = Array(14).fill(0);
  const dailyHours = await Promise.all(
    dateRanges.map((range) =>
      Attendance.sum('hours', {
        where: {
          employee_id: employeeId,
          clock_out_time: { [Op.ne]: null },
          clock_in_time: { 
            [Op.gte]: range.start,
            [Op.lte]: range.end
          },
        },
      })
    )
  );

  return dailyHours.map((hours) => roundToDecimal(hours, 1));
};

const getNextUpcomingShift = async (employeeId) => {
  // First, try to get today's shifts
  const today = dayjs().format('YYYY-MM-DD');
  let shift = await Shift.findOne({
    where: {
      date: today,
    },
    include: [
      {
        model: EmployeeShift,
        as: 'employee_shifts',
        where: {
          employee_id: employeeId,
          status: 'scheduled',
        },
        required: true,
      },
      {
        model: Client,
        as: 'client',
        attributes: ['business_name', 'location_address'],
      },
      {
        model: Attendance,
        as: 'attendances',
        where: { employee_id: employeeId },
        required: false,
        separate: true,
      },
    ],
    order: [
      ['start_time', 'ASC'],
    ],
  });

  // If no shift today, get the next upcoming shift
  if (!shift) {
    shift = await Shift.findOne({
      where: {
        date: { [Op.gt]: today },
      },
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          where: {
            employee_id: employeeId,
            status: 'scheduled',
          },
          required: true,
        },
        {
          model: Client,
          as: 'client',
          attributes: ['business_name', 'location_address'],
        },
        {
          model: Attendance,
          as: 'attendances',
          where: { employee_id: employeeId },
          required: false,
          separate: true,
        },
      ],
      order: [
        ['date', 'ASC'],
        ['start_time', 'ASC'],
      ],
    });
  }

  return shift ? formatShiftData(shift) : null;
};

const formatProfileData = (employee) => ({
  firstName: employee.user.first_name,
  lastName: employee.user.last_name,
  email: employee.user.email,
  position: employee.position,
  profileImage: employee.profile_image_url,
  hireDate: employee.hire_date,
});

const formatShiftData = (shift) => {
  const primaryAttendance = shift.attendances?.[0];

  return {
    id: shift.id,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    location: shift.client?.business_name || 'Location TBD',
    address: shift.client?.location_address || null,
    status: shift.employee_shifts[0]?.status || 'scheduled',
    attendance: primaryAttendance
      ? {
          clockIn: primaryAttendance.clock_in,
          clockOut: primaryAttendance.clock_out,
          status: primaryAttendance.status,
          notes: primaryAttendance.notes,
        }
      : null,
    Attendances:
      shift.attendances?.map((att) => ({
        id: att.id,
        clockIn: att.clock_in,
        clockOut: att.clock_out,
        status: att.status,
        notes: att.notes,
      })) || [],
  };
};

const roundToDecimal = (value, decimals) => (value ? Math.round(value * 10 ** decimals) / 10 ** decimals : 0);

const calculateEarnings = (hours, rate = 15) => Math.round((hours || 0) * rate);

const handleErrorResponse = (res, error) => {
  const status = error.message.includes('not found') ? 404 : 500;
  res.status(status).json({
    success: false,
    error: error.message || 'Request failed',
  });
};

module.exports = {
  getDashboardStats,
  getEmployeeProfile,
  getTodaysShifts,
};