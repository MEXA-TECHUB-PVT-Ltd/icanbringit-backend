const express = require("express");
const router = express.Router();
const controller = require("../../controllers/feedback/feedback");

router.post("/create", controller.add);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getAll", controller.getAll);
router.delete("/delete/:id", controller.delete);
router.delete("/deleteAll", controller.deleteAll);
router.get("/search/:query", controller.search);

module.exports = router;
