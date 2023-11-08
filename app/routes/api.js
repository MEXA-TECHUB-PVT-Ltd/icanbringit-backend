const express = require('express');

const router = express.Router();

const users = require('./users/users')
const uploads = require('./universal/uploads')


router.use("/users", users);
router.use("/uploads", uploads);


module.exports = router;
