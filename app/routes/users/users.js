const express = require('express');
const router = express.Router();
const controller = require("../../controllers/users/users");


router.post("/create", controller.create);
router.post("/verify_otp", controller.verify_otp);
router.post("/forgotPassword", controller.forgotPassword);
router.put("/resetPassword", controller.resetPassword);
router.put("/updatePassword", controller.updatePassword);
router.post("/signIn", controller.signIn);
router.get("/get/:id", controller.getUser);
router.get("/getAll", controller.getAllUsers);
router.get("/getRecentlyDeletedUsers", controller.getRecentlyDeletedUsers);
router.delete("/delete/:id", controller.deleteUser);

module.exports = router;
