const express = require("express");
const router = express.Router();
const controller = require("../../controllers/attendeeTasks/attendeeTasks");

router.post("/create", controller.create);

module.exports = router;
