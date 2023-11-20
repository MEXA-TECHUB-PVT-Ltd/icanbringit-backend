const express = require("express");
const router = express.Router();
const controller = require("../../controllers/questionTypeResponses/questionTypeResponses");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id/:type", controller.get);
router.get("/getAll/:type", controller.getAll);
router.delete("/delete/:type/:id", controller.delete);
router.delete("/deleteAll/:type/:user_id", controller.deleteAll);

module.exports = router;
