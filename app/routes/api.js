const express = require('express');

const router = express.Router();

const users = require('./users/users')
const uploads = require("./universal/uploads");
const questionTypes = require("./questionTypes/questionTypes");
const questionTypeResponses = require("./questionTypeResponses/questionTypeResponses");
const categories = require("./categories/categories");
const events = require("./events/events");
const attendeeTasks = require("./attendeeTasks/attendeeTasks");
const report = require("./report/report");
const block = require("./block/block");
const faq = require("./faq/faq");
const feedback = require("./feedback/feedback");
const notifications = require("./notifications/notifications");
const notificationTypes = require("./notificationTypes/notificationTypes");


router.use("/users", users);
router.use("/uploads", uploads);
router.use("/questionTypes", questionTypes);
router.use("/questionTypeResponses", questionTypeResponses);
router.use("/categories", categories);
router.use("/events", events);
router.use("/attendee", attendeeTasks); 
router.use("/report", report);
router.use("/block", block);
router.use("/faq", faq);
router.use("/feedback", feedback);
router.use("/notifications", notifications);
router.use("/notificationTypes", notificationTypes);


module.exports = router;
