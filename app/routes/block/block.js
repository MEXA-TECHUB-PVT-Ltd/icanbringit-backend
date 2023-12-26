const express = require("express");
const router = express.Router();
const controller = require("../../controllers/block/block");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getAll", controller.getAll);
router.get("/getAllByUser/:block_creator_id", controller.getAllByUser);
router.delete("/delete/:id", controller.delete);
router.delete("/deleteAll", controller.deleteAll);
router.delete(
  "/deleteAllByUser/:report_creator_id",
  controller.deleteAllByUser
);

module.exports = router;
