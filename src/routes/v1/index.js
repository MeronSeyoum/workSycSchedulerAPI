const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const docsRoute = require('./docs.route');
const employeeRoute = require('./employee.route');
const clinetRoute = require('./client.route');
const shiftRoute = require('./shift.route');
const qrcodeRoute = require('./qrcode.route');
const employeeShiftsRoute =require('./employeeShifts.route')
const dashboardRoute =require('./dashboard.route')
const usersRoute = require('./user.route')
const attendanceRoute = require('./attendance.route')

const devRoutes = [
  {
    path: '/docs',
    route: docsRoute,
  },
];

const userRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/employees',
    route: employeeRoute,
  },
  {
    path: '/clients',
    route: clinetRoute,
  },
  {
    path: '/shifts',
    route: shiftRoute,
  },
  {
    path: '/qrcodes',
    route: qrcodeRoute,
  },
  {
    path: '/employeeShifts',
    route: employeeShiftsRoute,
  },
  {
    path: '/dashboard',
    route: dashboardRoute,
  },
  {
    path: '/users',
    route: usersRoute,
  },
  {
    path: '/attendance',
    route: attendanceRoute,
  },
];
userRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (process.env.NODE_ENV === 'DEVELOPMENT') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
