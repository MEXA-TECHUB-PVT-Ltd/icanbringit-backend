const express = require("express");
const router = express.Router();
const controller = require("../../controllers/suggested_items/suggested_items");

router.post("/create", controller.create);
router.put("/update", controller.update);
router.get("/get/:id", controller.get);
router.get("/getAll", controller.getAll);
router.get("/getAllAdminWithUser/:user_id", controller.getAllAdminWithUser);
router.delete("/delete/:id", controller.delete);
router.delete("/deleteAll", controller.deleteAll);

module.exports = router;
