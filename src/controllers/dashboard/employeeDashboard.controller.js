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

// Dashboard Statistics
const getDashboardStats = async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const currentMonth = dayjs().startOf('month').toDate();

    const [totalShifts, totalHours] = await Promise.all([
      EmployeeShift.count({
        where: { employee_id: employeeId },
        include: [
          {
            model: Shift,
            as: 'shift',
            where: { date: { [Op.gte]: currentMonth } },
          },
        ],
      }),

      Attendance.sum('hours', {
        where: {
          employee_id: employeeId,
          clock_out_time: { [Op.ne]: null },
          created_at: { [Op.gte]: currentMonth },
        },
      }),
    ]);

    const chartData = await getWeeklyChartData(employeeId);
    const upcomingShift = await getNextUpcomingShift(employeeId);

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
  const chartData = Array(14).fill(0);
  const dateRanges = Array.from({ length: 14 }, (_, i) => ({
    start: dayjs()
      .subtract(13 - i, 'day')
      .startOf('day')
      .toDate(),
    end: dayjs()
      .subtract(13 - i, 'day')
      .endOf('day')
      .toDate(),
  }));

  const dailyHours = await Promise.all(
    dateRanges.map((range) =>
      Attendance.sum('hours', {
        where: {
          employee_id: employeeId,
          clock_out_time: { [Op.ne]: null },
          clock_in_time: { [Op.between]: [range.start, range.end] },
        },
      })
    )
  );

  return dailyHours.map((hours) => roundToDecimal(hours, 1));
};

const getNextUpcomingShift = async (employeeId) => {
  const shift = await Shift.findOne({
    where: {
      date: { [Op.gte]: dayjs().format('YYYY-MM-DD') },
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
  const primaryAttendance = shift.attendances?.[0]; // Get most recent attendance

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

// const formatShiftData = (shift) => ({
//   id: shift.id,
//   date: shift.date,
//   startTime: shift.start_time,
//   endTime: shift.end_time,
//   location: shift.client.business_name,
//   address: shift.client.location_address,
//   status: shift.employee_shifts[0].status
// });

const roundToDecimal = (value, decimals) => (value ? Math.round(value * 10 ** decimals) / 10 ** decimals : 0);

const calculateEarnings = (hours, rate = 15) => Math.round((hours || 0) * rate);

const handleErrorResponse = (res, error) => {
  const status = error.message.includes('not found') ? 404 : 500;
  res.status(status).json({
    success: false,
    error: error.message || 'Request failed',
  });
};

// Export all controller functions
module.exports = {
  getDashboardStats,
  getEmployeeProfile,
  getTodaysShifts,
};
