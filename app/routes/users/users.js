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

// ! user bio
router.post("/addBio", controller.addBio);
router.put("/updateBio", controller.updateBio);
router.get("/getUserBio/:id", controller.getUserBio);
// ! event type
router.post("/addEventType", controller.addEventType);
router.put("/updateEventType", controller.updateEventType);
router.get("/getEventType/:id", controller.getEventType);
router.get("/getAllEventTypes", controller.getAllEventTypes);
router.delete("/deleteEventType/:id", controller.deleteEventType);
router.delete("/deleteAllEventTypes", controller.deleteAllEventTypes);

// ! food preference
router.post("/addFoodPref", controller.addFoodPref);
router.put("/updateFoodPref", controller.updateFoodPref);
router.get("/getFoodPref/:id", controller.getFoodPref);
router.get("/getAllFoodPref", controller.getAllFoodPref);
router.delete("/deleteFoodPref/:id", controller.deleteFoodPref);
router.delete("/deleteAllFoodPref", controller.deleteAllFoodPref);

module.exports = router;


// Update profile api → user can update any data in profile, make api flexible.

//  Email cannot be updated. 

// Crud of food preferences

// crud of event types should be created and their values will be selected by user.

// You can teleflow of profile setup in xd
