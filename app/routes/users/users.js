const express = require('express');
const router = express.Router();
const controller = require("../../controllers/users/users");


router.post("/create", controller.create);
router.post("/verify_otp", controller.verify_otp);
router.post("/forgotPassword", controller.forgotPassword);
router.put("/resetPassword", controller.resetPassword);
router.put("/updatePassword", controller.updatePassword);
router.put("/updateProfile", controller.updateProfile);
router.put("/updateBlockStatus", controller.updateBlockStatus);
router.put("/updateDeactivateStatus", controller.updateDeactivateStatus);
router.post("/signIn", controller.signIn);
router.get("/get/:id", controller.getUser);
router.get("/search/:name", controller.search);
router.get("/getUsersByCountry/:country", controller.getUsersByCountry);
router.get("/addByYear", controller.addByYear);
router.get("/getAll", controller.getAllUsers);
router.get("/getRecentlyDeletedUsers", controller.getRecentlyDeletedUsers);
router.delete("/delete/:id", controller.deleteUser);
router.delete("/deleteAllUser", controller.deleteAllUser);



module.exports = router;


// Update profile api → user can update any data in profile, make api flexible.

//  Email cannot be updated. 

// Crud of food preferences

// crud of event types should be created and their values will be selected by user.

// You can teleflow of profile setup in xd
