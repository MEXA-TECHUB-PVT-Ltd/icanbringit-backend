const express = require("express");
const router = express.Router();
const controller = require("../../controllers/attendeeTasks/attendeeTasks");

router.post("/createTasks", controller.createTasks);
router.put("/updateStatus", controller.updateStatus);
router.get("/getAllEventAttendee/:event_id", controller.getAllEventAttendee);
router.get("/getAssignedTasks/:user_id", controller.getAssignedTasks);
router.get("/search/:name", controller.search);

module.exports = router;
