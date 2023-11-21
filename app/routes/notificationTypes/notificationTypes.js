const express = require("express");
const router = express.Router();
const controller = require("../../controllers/notificationTypes/notificationTypes");

router.post("/create", controller.createType);
router.put("/update", controller.updateType);
router.get("/get/:notification_type_id", controller.getSpecificType);
router.get("/getAll", controller.getAllTypes);
router.delete("/delete/:notification_type_id", controller.deleteType);
router.delete("/deleteAll", controller.deleteAllType);

module.exports = router;

