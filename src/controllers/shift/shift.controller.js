// src/controllers/shift/shift.controller.js
const { Shift, EmployeeShift, Client, Employee, User, Notification , sequelize } = require('../../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

// Helper to check time conflicts
const hasShiftConflict = (shifts, employeeId, date, startTime, endTime, excludeShiftId = null) => {
  return shifts.some(s => 
    s.employee_id === employeeId &&
    s.date === date &&
    s.id !== excludeShiftId &&
    !(
      dayjs(s.end_time, 'HH:mm').isBefore(dayjs(startTime, 'HH:mm')) ||
      dayjs(s.start_time, 'HH:mm').isAfter(dayjs(endTime, 'HH:mm'))
    )
  )
};

// Helper to format shift response
const formatShiftResponse = (shift) => {
  return {
    id: shift.id,
    date: shift.date,
    start_time: shift.start_time,
    end_time: shift.end_time,
    client_id: shift.client_id,
    created_by: shift.created_by,
    shift_type: shift.shift_type,
    notes: shift.notes,
    created_at: shift.created_at,
    updated_at: shift.updated_at,
    employee_shifts: shift.employee_shifts?.map(es => ({
      id: es.id,
      employee_id: es.employee_id,
      shift_id: es.shift_id,
      assigned_by: es.assigned_by,
      status: es.status,
      notes: es.notes,
      created_at: es.created_at,
      updated_at: es.updated_at,
      employee: es.employee ? {
        id: es.employee.id,
        user_id: es.employee.user_id,
        employee_code: es.employee.employee_code,
        position: es.employee.position,
        status: es.employee.status,
        user: es.employee.user
      } : undefined
    })),
    client: shift.client
  };
};
// const formatShiftResponse = (shift) => {
//   return {
//     id: shift.id,
//     date: shift.date,
//     start_time: shift.start_time,
//     end_time: shift.end_time,
//     client_id: shift.client_id,
//     shift_type: shift.shift_type,
//     notes: shift.notes,
//     created_at: shift.created_at
//   };
// };
exports.getAll = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;

    // Validate parameters
    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: clientId, startDate, and endDate are all required'
      });
    }

    // Validate date format
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      });
    }

    // Check if client exists
    const clientExists = await Client.findByPk(clientId);
    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: `Client with ID ${clientId} not found`
      });
    }

    const shifts = await Shift.findAll({
      where: {
        client_id: clientId,
        date: { 
          [Op.between]: [startDate, endDate] 
        }
      },
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          required: false, // Make this optional to return shifts even without employees
          include: [
            {
              model: Employee,
              as: 'employee',
              required: false,
              include: [{
                model: User,
                as: 'user',
                attributes: ['first_name', 'last_name', 'email'],
                required: false
              }]
            },
            {
              model: User,
              as: 'assigner',
              attributes: ['id', 'first_name', 'last_name'],
              required: false
            }
          ]
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'business_name']
        }
      ],
      order: [
        ['date', 'ASC'],
        ['start_time', 'ASC']
      ]
    });

    if (!shifts || shifts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No shifts found for the specified criteria',
        data: [],
        query: {
          clientId,
          startDate,
          endDate
        }
      });
    }

    // Format response
    const formattedShifts = shifts.map(shift => {
      const shiftData = shift.get({ plain: true });
      
      shiftData.employees = (shiftData.employee_shifts || []).map(es => ({
        assignment_id: es.id,
        status: es.status,
        notes: es.notes,
        assigned_by: es.assigner,
        employee: es.employee ? {
          id: es.employee.id,
          position: es.employee.position,
          employee_code: es.employee.employee_code,
          hire_date: es.employee.hire_date,
          user: es.employee.user
        } : null
      }));
      
      delete shiftData.employee_shifts;
      return shiftData;
    });

    res.json({
      success: true,
      count: formattedShifts.length,
      data: formattedShifts
    });

  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shifts',
      error: process.env.NODE_ENV === 'development' ? error.message : null,
      stack: process.env.NODE_ENV === 'development' ? error.stack : null
    });
  }
};

// Helper function to validate date format
function isValidDate(dateString) {
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regEx)) return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

exports.getByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
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
          include: ['employee']
        },
        {
          model: Client,
          as: 'client'
        }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });
    res.json(shifts.map(formatShiftResponse));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch employee shifts',
      details: error.message 
    });
  }
};

exports.getByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, status } = req.query;
    
    const where = {
      client_id: clientId
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
          include: ['employee']
        },
        {
          model: Client,
          as: 'client'
        }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    res.json(shifts.map(formatShiftResponse));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch client shifts',
      details: error.message 
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await Shift.findByPk(id, {
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          include: ['employee']
        },
        {
          model: Client,
          as: 'client'
        }
      ]
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json(formatShiftResponse(shift));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch shift',
      details: error.message 
    });
  }
};

// exports.createShiftWithEmployees = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { client_id, date, start_time, end_time, shift_type, employee_ids = [], notes } = req.body;
//     const assigned_by = req.user.id;

//     // Validate required fields
//     if (!client_id || !date || !start_time || !end_time || !shift_type) {
//       await transaction.rollback();
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     // Validate time
//      if (dayjs(end_time, 'HH:mm').isBefore(dayjs(start_time, 'HH:mm'))) {
//       await transaction.rollback();
//       return res.status(400).json({ error: 'End time must be after start time' });
//     }

//     // Check client exists
//     const client = await Client.findByPk(client_id, { transaction });
//     if (!client) {
//       await transaction.rollback();
//       return res.status(404).json({ error: 'Client not found' });
//     }

//     // Create shift
//     const shift = await Shift.create({
//       date,
//       start_time,
//       end_time,
//       client_id,
//       shift_type,
//       created_by: assigned_by,
//       notes
//     }, { transaction });

//     const conflictErrors = [];
//     const employeeShiftsData = [];
//     const uniqueEmployeeIds = [...new Set(employee_ids)];

//     // Process each employee assignment
//     for (const employee_id of uniqueEmployeeIds) {
//       const employee = await Employee.findByPk(employee_id, { 
//         transaction,
//         include: [{
//           model: User,
//           as: 'user',
//           attributes: ['first_name', 'last_name']
//         }]
//       });

//       if (!employee) {
//         conflictErrors.push(`Employee ${employee_id} not found`);
//         continue;
//       }

//       // Check employee assignment to location
//       if (!employee.assigned_locations?.includes(client.business_name)) {
//         conflictErrors.push(
//           `Employee ${employee.user?.first_name} ${employee.user?.last_name} is not assigned to this location`
//         );
//         continue;
//       }

//       employeeShiftsData.push({
//         employee_id,
//         shift_id: shift.id,
//         assigned_by,
//         status: 'scheduled',
//         notes
//       });
//     }

//     // Handle complete failure case
//     if (conflictErrors.length > 0 && employeeShiftsData.length === 0) {
//       await transaction.rollback();
//       return res.status(400).json({ 
//         error: 'All employee assignments failed',
//         details: conflictErrors 
//       });
//     }

//     // Create employee shifts
//     const employeeShifts = await EmployeeShift.bulkCreate(employeeShiftsData, { 
//       transaction,
//       returning: true
//     });

//     await transaction.commit();

//     // Prepare response
//     const response = {
//      success: true,
//       message: 'Shift created successfully',
//       data: {
//        ...formatShiftResponse(shift),
//       employees: employeeShifts.map(es => ({
//        assignment_id: es.id,
//          employee_id: es.employee_id,
//          status: es.status
//        }))
// }
//      };

//     // Add warnings if partial success
//      if (conflictErrors.length > 0) {
//        response.warnings = conflictErrors;
//        return res.status(207).json(response);
//      }

//      res.status(201).json(response);


    
//   } catch (error) {
//     await transaction.rollback();
//     console.error('Shift creation error:', error);
//     res.status(500).json({ 
//       error: 'Failed to create shift',
//       details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// };


exports.createShiftWithEmployees = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { client_id, date, start_time, end_time, shift_type, employee_ids = [], notes } = req.body;
    const assigned_by = req.user.id;

    // Validate required fields
    if (!client_id || !date || !start_time || !end_time || !shift_type) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate time
    if (dayjs(end_time, 'HH:mm').isBefore(dayjs(start_time, 'HH:mm'))) {
      await transaction.rollback();
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check client exists
    const client = await Client.findByPk(client_id, { transaction });
    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Client not found' });
    }

    console.log("shift date : ", date);

    // Create shift
    const shift = await Shift.create({
      date,
      start_time,
      end_time,
      client_id,
      shift_type,
      created_by: assigned_by,
      notes,
    }, { transaction });

    const conflictErrors = [];
    const employeeShiftsData = [];
    const notifications = [];
    const uniqueEmployeeIds = [...new Set(employee_ids)];

    // Process each employee assignment
    for (const employee_id of uniqueEmployeeIds) {
      const employee = await Employee.findByPk(employee_id, { 
        transaction,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name']
        }]
      });

      if (!employee) {
        conflictErrors.push(`Employee ${employee_id} not found`);
        continue;
      }

      // Check employee assignment to location
      if (!employee.assigned_locations?.includes(client.business_name)) {
        conflictErrors.push(
          `Employee ${employee.user?.first_name} ${employee.user?.last_name} is not assigned to this location`
        );
        continue;
      }

      // Create employee shift assignment
      const employeeShift = await EmployeeShift.create({
        employee_id,
        shift_id: shift.id,
        assigned_by,
        status: 'scheduled',
        notes
      }, { transaction });

      employeeShiftsData.push(employeeShift);

      // Create notification for employee
      try {
        const notification = await createShiftAssignmentNotification(
          employee_id,
          shift.id,
          transaction // Pass the transaction
        );
        notifications.push(notification);
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
        conflictErrors.push(
          `Failed to notify employee ${employee.user?.first_name} ${employee.user?.last_name}`
        );
      }
    }

    // Handle complete failure case
    if (conflictErrors.length > 0 && employeeShiftsData.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'All employee assignments failed',
        details: conflictErrors 
      });
    }

    await transaction.commit();

    // Prepare response
    const response = {
      success: true,
      message: 'Shift created successfully',
      data: {
        ...formatShiftResponse({
          ...shift.get({ plain: true }),
          employee_shifts: employeeShiftsData,
          client
        }),
        employees: employeeShiftsData.map(es => ({
          assignment_id: es.id,
          employee_id: es.employee_id,
          status: es.status
        }))
      }
    };

    // Add warnings if partial success
    if (conflictErrors.length > 0) {
      response.warnings = conflictErrors;
      return res.status(207).json(response);
    }

    res.status(201).json(response);
    
  } catch (error) {
    await transaction.rollback();
    console.error('Shift creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create shift',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};



exports.createRecurring = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { client_id, start_date, end_date, days_of_week, start_time, end_time, shift_type, employee_ids, notes } = req.body;
    const assigned_by = req.user.id;

    // Validate time
    if (dayjs(end_time, 'HH:mm').isBefore(dayjs(start_time, 'HH:mm'))) {
      await transaction.rollback();
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check client exists
    const client = await Client.findByPk(client_id, { transaction });
    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Client not found' });
    }

    // Generate dates for recurring shifts
    const start = dayjs(start_date);
    const end = dayjs(end_date);
    const dates = [];
    let current = start;

    while (current.isSameOrBefore(end)) {
      if (days_of_week.includes(current.day())) {
        dates.push(current.format('YYYY-MM-DD'));
      }
      current = current.add(1, 'day');
    }

    // Get all existing shifts for conflict checking
    const existingShifts = await Shift.findAll({
      where: { date: dates },
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts'
      }],
      transaction
    });

    const createdShifts = [];
    const conflictErrors = [];

    for (const date of dates) {
      for (const employee_id of employee_ids) {
        const employee = await Employee.findByPk(employee_id, { transaction });
        if (!employee) {
          conflictErrors.push(`Employee ${employee_id} not found for date ${date}`);
          continue;
        }

        // Check if employee is assigned to this location
        if (!employee.assigned_locations?.includes(client.business_name)) {
          conflictErrors.push(
            `Employee ${employee.first_name} ${employee.last_name} is not assigned to this location on ${date}`
          );
          continue;
        }

        // Check for schedule conflicts
        if (hasShiftConflict(existingShifts, employee_id, date, start_time, end_time)) {
          conflictErrors.push(
            `Employee ${employee.first_name} ${employee.last_name} has a scheduling conflict on ${date}`
          );
          continue;
        }

        // Create shift if no conflicts
        const shift = await Shift.create({
          date,
          start_time,
          end_time,
          client_id,
          shift_type,
          created_by: assigned_by,
          notes
        }, { transaction });

        const employeeShift = await EmployeeShift.create({
          employee_id,
          shift_id: shift.id,
          assigned_by,
          status: 'scheduled',
          notes
        }, { transaction });

        createdShifts.push({
          ...formatShiftResponse(shift),
          employee_shifts: [employeeShift]
        });
      }
    }

    if (createdShifts.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'No shifts created due to conflicts',
        details: conflictErrors 
      });
    }

    await transaction.commit();
    res.status(201).json({
      created_shifts: createdShifts,
      warnings: conflictErrors.length > 0 ? conflictErrors : undefined
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ 
      error: 'Failed to create recurring shifts',
      details: error.message 
    });
  }
};

exports.updateShift = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { start_time, end_time, notes } = req.body;

    const shift = await Shift.findByPk(id, {
      include: [{
        model: EmployeeShift,
        as: 'employee_shifts',
        include: ['employee']
      }],
      transaction
    });

    if (!shift) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Validate time
    if (dayjs(end_time, 'HH:mm').isBefore(dayjs(start_time, 'HH:mm'))) {
      await transaction.rollback();
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Check for conflicts if times changed
    if (start_time !== shift.start_time || end_time !== shift.end_time) {
      const existingShifts = await Shift.findAll({
        where: { 
          date: shift.date,
          id: { [Op.ne]: id }
        },
        include: [{
          model: EmployeeShift,
          as: 'employee_shifts'
        }],
        transaction
      });

      for (const employeeShift of shift.employee_shifts) {
        if (hasShiftConflict(
          existingShifts, 
          employeeShift.employee_id, 
          shift.date, 
          start_time, 
          end_time
        )) {
          const employee = await Employee.findByPk(employeeShift.employee_id, { transaction });
          await transaction.rollback();
          return res.status(400).json({
            error: 'Schedule conflict',
            message: `Employee ${employee.first_name} ${employee.last_name} has a conflicting shift`
          });
        }
      }
    }

    // Update shift
    await shift.update({ start_time, end_time, notes }, { transaction });

    await transaction.commit();
    const updatedShift = await Shift.findByPk(id, {
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          include: ['employee']
        },
        {
          model: Client,
          as: 'client'
        }
      ]
    });

    res.json(formatShiftResponse(updatedShift));
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ 
      error: 'Failed to update shift',
      details: error.message 
    });
  }
};

exports.updateStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { status, employee_id } = req.body;

    const shift = await Shift.findByPk(id, { transaction });
    if (!shift) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Shift not found' });
    }

    const employeeShift = await EmployeeShift.findOne({
      where: {
        shift_id: id,
        employee_id: employee_id || { [Op.ne]: null }
      },
      transaction
    });

    if (!employeeShift) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Employee shift assignment not found' });
    }

    await employeeShift.update({ status }, { transaction });

    await transaction.commit();
    const updatedShift = await Shift.findByPk(id, {
      include: [
        {
          model: EmployeeShift,
          as: 'employee_shifts',
          include: ['employee']
        },
        {
          model: Client,
          as: 'client'
        }
      ]
    });

    res.json(formatShiftResponse(updatedShift));
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ 
      error: 'Failed to update shift status',
      details: error.message 
    });
  }
};

exports.delete = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const shift = await Shift.findByPk(id, { transaction });
    if (!shift) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Delete associated employee shifts first
    await EmployeeShift.destroy({
      where: { shift_id: id },
      transaction
    });

    await shift.destroy({ transaction });

    await transaction.commit();
    res.json({ 
      message: 'Shift deleted successfully',
      deleted_id: id
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ 
      error: 'Failed to delete shift',
      details: error.message 
    });
  }
};

exports.moveShiftToDate = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { shiftId, newDate, employeeId } = req.body;
    
    // Validate new date
    if (!dayjs(newDate, 'YYYY-MM-DD', true).isValid()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get existing shift
    const shift = await Shift.findByPk(shiftId, { transaction });
    if (!shift) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Check if shift already exists at new date
    const existingShift = await Shift.findOne({
      where: {
        client_id: shift.client_id,
        date: newDate,
        start_time: shift.start_time,
        end_time: shift.end_time
      },
      transaction
    });

    let targetShift = existingShift;
    
    // Create new shift if doesn't exist
    if (!existingShift) {
      targetShift = await Shift.create({
        client_id: shift.client_id,
        date: newDate,
        start_time: shift.start_time,
        end_time: shift.end_time,
        shift_type: shift.shift_type,
        created_by: shift.created_by,
        notes: shift.notes
      }, { transaction });
    }

    // Move employee
    await EmployeeShift.destroy({
      where: { shift_id: shiftId, employee_id: employeeId },
      transaction
    });

    await EmployeeShift.create({
      employee_id: employeeId,
      shift_id: targetShift.id,
      assigned_by: req.user.id,
      status: 'scheduled'
    }, { transaction });

    await transaction.commit();
    
    res.status(200).json({
      success: true,
      message: 'Shift moved successfully',
      data: {
        oldShiftId: shiftId,
        newShift: targetShift
      }
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ 
      success: false,
      message: 'Failed to move shift',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const createShiftAssignmentNotification = async (employeeId, shiftId, transaction) => {
  try {
    const employee = await Employee.findByPk(employeeId, {
      transaction,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id']
      }]
    });

    const shift = await Shift.findByPk(shiftId, {
      transaction,
      include: [{
        model: Client,
        as: 'client',
        attributes: ['business_name', ]
      }]
    });

    if (!employee || !shift) {
      throw new Error('Employee or Shift not found');
    }

    const notification = await Notification.create({
      userId: employee.user.id,
      employeeId: employee.id,
      tenantId: shift.client.tenant_id,
      type: 'assignment',
      title: 'New Shift Assigned',
      message: `You have been assigned a shift on ${dayjs(shift.date).format('MMMM D, YYYY')} at ${shift.start_time} at ${shift.client.business_name}.`,
      relatedEntityType: 'shift',
      relatedEntityId: shift.id,
      metadata: {
        shiftId: shift.id,
        date: shift.date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        clientName: shift.client.business_name
      }
    }, { transaction });

    return notification;
  } catch (error) {
    console.error('Error creating shift assignment notification:', error);
    throw error;
  }
};
