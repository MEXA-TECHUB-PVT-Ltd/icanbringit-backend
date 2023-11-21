const express = require('express');

const router = express.Router();

const users = require('./users/users')
const uploads = require("./universal/uploads");
const questionTypes = require("./questionTypes/questionTypes");
const questionTypeResponses = require("./questionTypeResponses/questionTypeResponses");
const categories = require("./categories/categories");
const events = require("./events/events");
const attendeeTasks = require("./attendeeTasks/attendeeTasks");


router.use("/users", users);
router.use("/uploads", uploads);
router.use("/questionTypes", questionTypes);
router.use("/questionTypeResponses", questionTypeResponses);
router.use("/categories", categories);
router.use("/events", events);
router.use("/attendeeTasks", attendeeTasks);


module.exports = router;
