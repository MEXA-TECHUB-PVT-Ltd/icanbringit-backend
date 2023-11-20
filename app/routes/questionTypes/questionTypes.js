const express = require("express");
const router = express.Router();
const controller = require("../../controllers/questionTypes/questionTypes");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:type/:id", controller.get);
router.get("/getAll/:type", controller.getAll);
router.delete("/delete/:type/:id", controller.delete);
router.delete("/deleteAll/:type", controller.deleteAll);


module.exports = router;
