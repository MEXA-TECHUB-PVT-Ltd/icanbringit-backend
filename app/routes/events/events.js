const express = require("express");
const router = express.Router();
const controller = require("../../controllers/events/events");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id/:user_id", controller.get);
router.get("/getAll/:user_id", controller.getAll);
router.delete("/delete/:id/:user_id", controller.delete);
router.delete("/deleteAll/:user_id", controller.deleteAll);

module.exports = router;
