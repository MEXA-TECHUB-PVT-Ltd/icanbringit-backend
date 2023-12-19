const express = require("express");
const router = express.Router();
const controller = require("../../controllers/universal/uploads");
const { cloudinaryUpload, localUpload } = require("../../middlewares/uploads");

router.post("/cloudinary", cloudinaryUpload.single("file"), controller.upload);
router.post("/local", localUpload.single("file"), controller.upload);

module.exports = router;
