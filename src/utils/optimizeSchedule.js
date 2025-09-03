// utils/optimizeSchedule.js
const { Employee, EmployeeAvailability, EmployeeSkill, Skill, Shift } = require("../models");

async function optimizeSchedule(options) {
  // Fetch employees with availability and skills
  const employees = await Employee.findAll({
    include: [
      { model: EmployeeAvailability, as: "availability" },
      { 
        model: EmployeeSkill,
        as: "skills",
        include: [{ model: Skill, as: "skill" }],
      },
    ],
  });

  // Fetch open shifts
  const shifts = await Shift.findAll();

  const assignments = [];

  for (const shift of shifts) {
    // Example: required skill (if any)
    const requiredSkill = shift.shift_type === "nurse" ? "Nursing" : null;

    // Filter employees who are available and match skills
    const availableEmployees = employees.filter((emp) => {
      const dayName = shift.date.toLocaleString("en-US", { weekday: "long" });

      // Check availability
      const isAvailable = emp.availability.some((a) => {
        return (
          a.day_of_week === dayName &&
          a.start_time <= shift.start_time &&
          a.end_time >= shift.end_time
        );
      });

      // Check skills if required
      const hasSkill = requiredSkill
        ? emp.skills.some((s) => s.skill.name === requiredSkill)
        : true;

      return isAvailable && hasSkill;
    });

    // Choose employee based on selected optimization criteria
    let chosenEmployee = null;

    if (options.includes("fairness")) {
      // Balance shifts across employees (simplified)
      chosenEmployee = availableEmployees.sort(
        (a, b) => (a.shifts?.length || 0) - (b.shifts?.length || 0)
      )[0];
    } else if (options.includes("cost")) {
      // If you had wages, choose lowest-cost
      chosenEmployee = availableEmployees[0];
    } else {
      // Default: pick first available
      chosenEmployee = availableEmployees[0];
    }

    if (chosenEmployee) {
      assignments.push({
        shiftId: shift.id,
        employeeId: chosenEmployee.id,
      });
    }
  }

  return assignments;
}

module.exports = { optimizeSchedule };
