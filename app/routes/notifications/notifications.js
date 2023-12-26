const express = require("express");
const router = express.Router();
const controller = require("../../controllers/notifications/notifications");

router.post("/create", controller.createNotification);
router.put("/update", controller.updateNotification);
router.put("/readNotification", controller.readNotification);
router.get(
  "/getAllByUser/:user_id",
  controller.getAllNotificationsByUser
);
router.get(
  "/getAllReadByUser/:user_id",
  controller.getAllReadNotificationsByUser
);
router.get(
  "/getAllUnReadByUser/:user_id",
  controller.getAllUnReadNotificationsByUser
);
router.delete(
  "/delete/:notification_id",
  controller.deleteNotification
);

module.exports = router;
