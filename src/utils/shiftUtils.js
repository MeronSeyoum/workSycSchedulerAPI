// src/utils/shiftUtils.js
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const isBetween = require('dayjs/plugin/isBetween');

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

/**
 * Generate dates for recurring shifts
 */
const generateRecurringShifts = (startDate, endDate, daysOfWeek) => {
  const dates = [];
  let currentDate = dayjs(startDate);
  const end = dayjs(endDate);
  
  while (currentDate.isSameOrBefore(end)) {
    if (daysOfWeek.includes(currentDate.day())) {
      dates.push(currentDate.format('YYYY-MM-DD'));
    }
    currentDate = currentDate.add(1, 'day');
  }
  
  return dates;
};

module.exports = {
  generateRecurringShifts
};