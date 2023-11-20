const express = require("express");
const router = express.Router();
const controller = require("../../controllers/events/events");

// ! increment the count of event in user table
router.post("/create", controller.create);
router.post("/joinEvent", controller.joinEvent);
router.put("/update", controller.update);
router.get("/get/:id/:user_id", controller.get);
router.get("/getAll/:user_id", controller.getAll);
router.get("/getAllByCategory/:category", controller.getAllByCategory);
router.get("/search/:title", controller.search);
router.get("/filterEvents", controller.filterEvents);
router.get("/getAllEventsWithDetails", controller.getAllEventsWithDetails);
router.delete("/delete/:id/:user_id", controller.delete);
router.delete("/deleteAll/:user_id", controller.deleteAll);

module.exports = router;
