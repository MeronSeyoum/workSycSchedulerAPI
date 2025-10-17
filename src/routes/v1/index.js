// routes/v1/index.js
const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const docsRoute = require('./docs.route');
const employeeRoute = require('./employee.route');
const clinetRoute = require('./client.route');
const shiftRoute = require('./shift.route');
const qrcodeRoute = require('./qrcode.route');
const employeeShiftsRoute = require('./employeeShifts.route');
const dashboardRoute = require('./dashboard.route');
const usersRoute = require('./user.route');
const attendanceRoute = require('./attendance.route');
const employeeDashboardRoute = require('./employeeDashboard.route');
const notificationsRoute = require('./notification.route');
const chatRoute = require('./chat.route');
const geofencesRoute = require('./geofence.route');
const shiftPhotosRoute = require('./shiftPhotos.route'); 
const photoComplaintsRoute = require('./photoComplaint.route');
const taskRoutes = require('./task.route');

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
  {
    path: '/employeesDashboard',
    route: employeeDashboardRoute,
  },
  {
    path: '/notifications',
    route: notificationsRoute,
  },
  {
    path: '/geofences',
    route: geofencesRoute,
  },
  {
    path: '/chat',
    route: chatRoute,
  },
 {
    path: '/shiftPhotos',
    route: shiftPhotosRoute, // ✅ This should point to your shiftPhoto.route.js
  },
  {
    path: '/photo-complaints',
    route: photoComplaintsRoute,
  },
  {
    path: '/tasks',
    route: taskRoutes,
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
