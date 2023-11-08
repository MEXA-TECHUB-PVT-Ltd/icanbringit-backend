const express = require("express");
const router = express.Router();
const controller = require("../../controllers/universal/uploads");
const upload = require("../../middlewares/uploads");

router.post("/", upload.single("file"), controller.upload);

module.exports = router;
