const express = require("express");
const router = express.Router();
const controller = require("../../controllers/events/events");

// ! increment the count of event in user table
router.post("/create", controller.create);
router.post("/joinEventsWithTypes", controller.joinEventsWithTypes);
router.put("/update", controller.update);
router.put("/updateJoinEventAttendeeTypeAndStatus", controller.updateJoinEventAttendeeTypeAndStatus);
router.get("/get/:id/:user_id", controller.get);
router.get("/get/:id", controller.getEvent); 
router.get("/getAllByUser/:user_id", controller.getAllByUser);
router.get("/getAll", controller.getAll);
router.get("/getAllUpComingByUser/:user_id", controller.getAllUpComingByUser);
router.get("/getAllByCategory/:category_id", controller.getAllByCategory);
router.get("/search/:title", controller.search);
router.get("/filterEvents", controller.filterEvents);
router.get("/getAllEventsWithDetails", controller.getAllEventsWithDetails);
router.get("/getAllEventByQuestionTypes", controller.getAllEventByQuestionTypes);
router.delete("/delete/:id/:user_id", controller.delete);
router.delete("/deleteAll/:user_id", controller.deleteAll);

module.exports = router;
