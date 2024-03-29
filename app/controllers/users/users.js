const { pool } = require("../../config/db.config");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../../lib/sendEmail");
const sendOtp = require("../../util/sendOtp");
const ejs = require("ejs");
const path = require("path");
const {
  getPaginatedResults,
  sendSuccessResponse,
} = require("../../util/genericDBFunc");

const renderEmailTemplate = async (templatePath, data) => {
  return new Promise((resolve, reject) => {
    ejs.renderFile(templatePath, data, (err, htmlContent) => {
      if (err) {
        reject(err);
      } else {
        resolve(htmlContent);
      }
    });
  });
};

exports.create = async (req, res) => {
  const {
    email,
    password,
    signup_type,
    device_id,
    role,
    google_access_token,
    apple_access_token,
    facebook_access_token,
  } = req.body;

  if (!signup_type || !device_id) {
    return res.status(400).json({
      status: false,
      message: "Signup type and device_id is required",
    });
  }

  try {
    let id;
    const userRole = role || "user";
    let insertQuery, insertValues;

    // Check for duplicate email only for email signup
    if (signup_type === "email" && (!email || !password)) {
      return res.status(400).json({
        status: false,
        message: "email, and password are required for email signup",
      });
    }

    if (signup_type == "google" && (!email || !google_access_token)) {
      return res.status(400).json({
        status: false,
        message: "email, and google_access_token are required for email signup",
      });
    }
    if (signup_type == "apple" && (!email || !apple_access_token)) {
      return res.status(400).json({
        status: false,
        message: "email, and apple_access_token are required for email signup",
      });
    }
    if (signup_type == "facebook" && (!email || !facebook_access_token)) {
      return res.status(400).json({
        status: false,
        message:
          "email, and facebook_access_token are required for email signup",
      });
    }

    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );
    if (checkUserExists.rowCount > 0) {
      return res.status(409).json({
        status: false,
        message: "User already exists with this email",
      });
    }

    switch (signup_type) {
      case "email":
        const otp = crypto.randomInt(1000, 9999);
        // Insert email user logic
        const hashedPassword = await bcrypt.hash(password, 8);
        insertQuery =
          "INSERT INTO users (email, password, role, signup_type, otp, device_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *";
        insertValues = [
          email,
          hashedPassword,
          userRole,
          signup_type,
          otp,
          device_id,
        ];
        // Render the EJS template to a string
        const signUpTemplatePath = path.join(
          __dirname,
          "..",
          "..",
          "views",
          "signup.ejs"
        );
        const emailTemplatePath = path.join(
          __dirname,
          "..",
          "..",
          "views",
          "emailVerification.ejs"
        );
        const dataForEjs = {
          verification_code: otp,
          date: new Date().toLocaleDateString("en-US"),
        };

        const htmlContent = await renderEmailTemplate(
          emailTemplatePath,
          dataForEjs
        );
        const emailSent = await sendEmail(
          email,
          "Sign Up Verification",
          htmlContent
        );

        if (!emailSent.success) {
          console.log("email not sent");
          // return res.status(500).json({
          //   status: false,
          //   message: emailSent.message,
          // });
        }
        break;
      case "google":
        if (!google_access_token) {
          return res.status(400).json({
            status: false,
            message: "Google access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (email, google_access_token, role, signup_type, device_id) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [
          email,
          google_access_token,
          userRole,
          signup_type,
          device_id,
        ];
        break;
      case "facebook":
        if (!facebook_access_token) {
          return res.status(400).json({
            status: false,
            message: "Google access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (email, facebook_access_token, role, signup_type, device_id) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [
          email,
          facebook_access_token,
          userRole,
          signup_type,
          device_id,
        ];
        break;
      case "apple":
        if (!apple_access_token) {
          return res.status(400).json({
            status: false,
            message: "Apple access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (email, apple_access_token, role, signup_type) VALUES ($1, $2, $3, $4) RETURNING *";
        insertValues = [email, apple_access_token, userRole, signup_type];
        break;
      default:
        return res.status(400).json({
          status: false,
          message: "Invalid signup type",
        });
    }

    const newUser = await pool.query(insertQuery, insertValues);
    userId = newUser.rows[0].id;

    delete newUser.rows[0].password;

    const response = {
      status: true,
      message: "We have sent you verification code",
      result: newUser.rows[0],
    };

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: 86400, // 24 hours
    });

    response.result.token = token;

    res.json({
      status: true,
      message: "Users created successfully",
      result: response,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// verify code for both email and forgot password
exports.verify_otp = async (req, res) => {
  const { email, otp, role, type } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ status: false, message: "email and otp are required" });
  }

  const defaultRole = role ? role : "user";

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE email = $1 AND role = $2",
      [email, defaultRole]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: `${defaultRole} not found`,
      });
    }

    const verify_otp_query = "SELECT 1 FROM users WHERE otp = $1";
    const verifyOtp = await pool.query(verify_otp_query, [otp]);
    if (verifyOtp.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "Invalid OTP",
      });
    }
    const nullOtp = null;
    const verifiedEmail = true;
    const update_otp_query =
      "UPDATE users SET otp = $1, verify_email = $2 WHERE email = $3";
    await pool.query(update_otp_query, [nullOtp, verifiedEmail, email]);
    return sendSuccessResponse(res, "Otp verified successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(404).json({ message: "Email is required!" });
  }
  const defaultRole = role ? role : "user";
  try {
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = $2",
      [email, defaultRole]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "Invalid email address!",
      });
    }
    const user_id = checkUserExists.rows[0].id;

    sendOtp(email, res, user_id);

    return res.status(200).json({
      status: true,
      message: "We've send the verification code on " + email,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Error Occurred",
      status: false,
      error: err.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, new_password, role } = req.body;
  try {
    if (!email || !new_password) {
      return res.status(401).json({
        status: false,
        message: "email and new_password are required",
      });
    }
    const defaultRole = role ? role : "user";

    const findUserQuery = `SELECT * FROM users WHERE email = $1 AND role = $2`;
    const findUser = await pool.query(findUserQuery, [email, defaultRole]);
    if (findUser.rowCount < 1) {
      return res.status(401).json({
        status: false,
        message: "User does not exist",
      });
    }
    const hash = await bcrypt.hash(new_password, 8);

    const query = `UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role, signup_type, created_at, updated_at`;
    const result = await pool.query(query, [hash, email]);

    res.json({
      status: true,
      message: "Password reset successfully!",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.updateDeactivateStatus = async (req, res) => {
  const { user_id, deactivate } = req.body;
  try {
    if (!user_id || deactivate === null) {
      return res.status(400).json({
        status: false,
        message: "user_id, and deactivate are required",
      });
    }
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [user_id]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User does not exist",
      });
    }

    let query;
    if (deactivate) {
      query = `UPDATE users SET deactivate = $1, deleted_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
    } else {
      query = `UPDATE users SET deactivate = $1, deleted_at = null WHERE id = $2 RETURNING *`;
    }

    const result = await pool.query(query, [deactivate, user_id]);
    res.json({
      status: true,
      message: `User ${deactivate ? "deactivated" : "activated"} Successfully!`,
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.updatePassword = async (req, res) => {
  const { email, old_password, new_password, role } = req.body;
  try {
    if (!email || !old_password || !new_password) {
      return res.status(401).json({
        status: false,
        message: "email, old_password and new_password are required",
      });
    }
    const defaultRole = role ? role : "user";

    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = $2",
      [email, defaultRole]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User does not exist",
      });
    }
    if (checkUserExists.rows[0].password != null) {
      const isMatch = await bcrypt.compare(
        old_password,
        checkUserExists.rows[0].password
      );
      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "Incorrect password",
        });
      }
    }
    const hash = await bcrypt.hash(new_password, 8);

    const query = `UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role, signup_type, created_at, updated_at`;
    const result = await pool.query(query, [hash, email]);
    res.json({
      status: true,
      message: "password updated Successfully!",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

exports.signIn = async (req, res) => {
  const {
    email,
    password,
    signin_type,
    google_access_token,
    apple_access_token,
    facebook_access_token,
    device_id,
    role,
  } = req.body;

  if (!email || !signin_type || !device_id) {
    return res.status(400).json({
      status: false,
      message: "Email, device_id and signin_type is required",
    });
  }
  const defaultRole = role ? role : "user";

  try {
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = $2",
      [email, defaultRole]
    );

    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User does not exist with this email",
      });
    }

    const user = checkUserExists.rows[0];

    if (user.deactivate) {
      const deactivatedUserQuery = `
        SELECT
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - deleted_at)) AS days_since_deleted,
          90 - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - deleted_at)) AS remaining_days
        FROM
          users
        WHERE
          email = $1 AND deactivate = TRUE
      `;
      const deactivatedUserDetails = await pool.query(deactivatedUserQuery, [
        email,
      ]);

      if (deactivatedUserDetails.rowCount > 0) {
        const deactivatedUserData = deactivatedUserDetails.rows[0];
        return res.status(409).json({
          status: false,
          message: "Your account has been deactivated",
          days_since_deleted: deactivatedUserData.days_since_deleted,
          remaining_days: deactivatedUserData.remaining_days,
        });
      }
    }

    // Handle password-based sign-in
    if (signin_type === "email") {
      if (!password) {
        return res.status(400).json({
          status: false,
          message: "Password is required for email sign-in",
        });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "Invalid Credentials",
        });
      }
    }
    // Handle OAuth-based sign-in
    else if (["google", "facebook", "apple"].includes(signin_type)) {
      let tokenMatches = true;
      switch (signin_type) {
        case "google":
          tokenMatches = google_access_token
            ? user.google_access_token === google_access_token
            : true;
          break;
        case "facebook":
          tokenMatches = facebook_access_token
            ? user.facebook_access_token === facebook_access_token
            : true;
          break;
        case "apple":
          tokenMatches = apple_access_token
            ? user.apple_access_token === apple_access_token
            : true;
          break;
      }

      if (!tokenMatches) {
        return res
          .status(401)
          .json({ status: false, message: "Invalid access token" });
      }
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid signup type" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    delete user.password;
    delete user.otp;

    return res.status(200).json({
      status: true,
      message: "Sign in successfully!",
      result: user,
      token: token,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "User ID is required" });
  }

  try {
    const userQuery = await pool.query(
      `
      SELECT 
    users.*, 
    uploads.file_name, 
    uploads.file_type, 
    uploads.file_url,
    json_agg(
      CASE 
        WHEN qt.type = 'event_category' THEN 
          json_build_object(
            'response_id', qtr.id, 
            'question_type_id', qtr.question_types_id, 
            'type', qt.type
          ) 
        ELSE NULL 
      END
    ) FILTER (WHERE qt.type = 'event_category') AS event_category_responses,
    json_agg(
      CASE 
        WHEN qt.type = 'location' THEN 
          json_build_object(
            'response_id', qtr.id, 
            'question_type_id', qtr.question_types_id, 
            'type', qt.type
          ) 
        ELSE NULL 
      END
    ) FILTER (WHERE qt.type = 'location') AS location_responses,
    json_agg(
      CASE 
        WHEN qt.type = 'food' THEN 
          json_build_object(
            'response_id', qtr.id, 
            'question_type_id', qtr.question_types_id, 
            'type', qt.type
          ) 
        ELSE NULL 
      END
    ) FILTER (WHERE qt.type = 'food') AS food_responses
FROM users 
LEFT JOIN uploads ON users.uploads_id = uploads.id
LEFT JOIN question_type_responses qtr ON users.id = qtr.user_id
LEFT JOIN question_types qt ON qtr.question_types_id = qt.id
WHERE users.id = $1 AND users.role = 'user'
GROUP BY users.id, uploads.id

      `,
      [id]
    );
    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const userData = userQuery.rows[0];
    delete userData.password;
    delete userData.otp;

    if (userData.deactivate) {
      return res
        .status(400)
        .json({ status: false, message: "Your account has been deactivated" });
    }
    return res.status(200).json({
      status: true,
      message: "User retrieved successfully",
      result: userData,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = "ALL",
      offset = 0,
      sortColumn = "id", // Default sorting column
      sortOrder = "desc", // Default sorting order
      total,
      totalPages,
    } = await getPaginatedResults(req, "users");

    let userQuery;
    if (limit === "ALL") {
      userQuery = `
        SELECT u.*, 
               array_agg(
                 json_build_object(
                   'response_id', qtr.id, 
                   'question_type_id', qtr.question_types_id, 
                   'response_type', qtr.type
                 )
               ) AS responses,
               up.file_name, up.file_type, up.file_url
        FROM users u
        LEFT JOIN question_type_responses qtr ON u.id = qtr.user_id
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user'
        GROUP BY u.id, up.id
        ORDER BY ${sortColumn} ${sortOrder === "asc" ? "ASC" : "DESC"};
      `;
      userQuery = await pool.query(userQuery);
    } else {
      userQuery = `
        SELECT u.*, 
               array_agg(
                 json_build_object(
                   'response_id', qtr.id, 
                   'question_type_id', qtr.question_types_id, 
                   'response_type', qtr.type
                 )
               ) AS responses,
               up.file_name, up.file_type, up.file_url
        FROM users u
        LEFT JOIN question_type_responses qtr ON u.id = qtr.user_id
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user'
        GROUP BY u.id, up.id
        ORDER BY ${sortColumn} ${sortOrder === "asc" ? "ASC" : "DESC"}
        LIMIT $1 OFFSET $2;
      `;
      userQuery = await pool.query(userQuery, [limit, offset]);
    }

    const users = userQuery.rows.map(
      ({ password, otp, ...userWithResponses }) => userWithResponses
    );

    sendSuccessResponse(res, "Users retrieved successfully", {
      currentPage: limit === "ALL" ? 1 : page,
      totalPages: limit === "ALL" ? 1 : totalPages,
      totalUsers: total,
      result: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllSubscribedUsers = async (req, res) => {
  try {
    // Check if limit and page are provided in the request
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const offset = page && limit ? (page - 1) * limit : 0;
    const isPaginationProvided = !isNaN(page) && !isNaN(limit);

    let userQuery;
    if (isPaginationProvided) {
      // Apply LIMIT and OFFSET if pagination parameters are provided
      userQuery = `
        SELECT u.*, up.file_name, up.file_type , up.file_url
        FROM users u
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user' AND u.payment_status = true
        ORDER BY u.id
        LIMIT $1 OFFSET $2;
      `;
      userQuery = await pool.query(userQuery, [limit, offset]);
    } else {
      // Fetch all subscribed users if pagination parameters are not provided
      userQuery = `
        SELECT u.*, up.file_name, up.file_type, up.file_url
        FROM users u
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user' AND u.payment_status = true
        ORDER BY u.id;
      `;
      userQuery = await pool.query(userQuery);
    }

    // Count total subscribed users
    const countQuery = `
      SELECT COUNT(*) FROM users 
      WHERE deleted_at IS NULL AND role = 'user' AND payment_status = true;
    `;
    const countResult = await pool.query(countQuery);
    const totalUsers = parseInt(countResult.rows[0].count, 10);
    const totalPages = isPaginationProvided ? Math.ceil(totalUsers / limit) : 1;

    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No subscribed users found.",
      });
    }

    const users = userQuery.rows.map(
      ({ password, otp, ...userWithoutSensitiveData }) =>
        userWithoutSensitiveData
    );

    return res.status(200).json({
      status: true,
      message: "Subscribed users retrieved successfully",
      currentPage: isPaginationProvided ? page : 1,
      totalPages: totalPages,
      totalUsers: totalUsers,
      users: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllBlockUsers = async (req, res) => {
  try {
    // Check if limit and page are provided in the request
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const offset = page && limit ? (page - 1) * limit : 0;
    const isPaginationProvided = !isNaN(page) && !isNaN(limit);

    let userQuery;
    if (isPaginationProvided) {
      // Apply LIMIT and OFFSET if pagination parameters are provided
      userQuery = `
        SELECT u.*, up.file_name, up.file_type , up.file_url
        FROM users u
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user' AND u.block_status = true
        ORDER BY u.id
        LIMIT $1 OFFSET $2;
      `;
      userQuery = await pool.query(userQuery, [limit, offset]);
    } else {
      // Fetch all blocked users if pagination parameters are not provided
      userQuery = `
        SELECT u.*, up.file_name, up.file_type , up.file_url
        FROM users u
        LEFT JOIN uploads up ON u.uploads_id = up.id
        WHERE u.deleted_at IS NULL AND u.role = 'user' AND u.block_status = true
        ORDER BY u.id;
      `;
      userQuery = await pool.query(userQuery);
    }

    // Count total blocked users
    const countQuery = `
      SELECT COUNT(*) FROM users 
      WHERE deleted_at IS NULL AND role = 'user' AND block_status = true;
    `;
    const countResult = await pool.query(countQuery);
    const totalUsers = parseInt(countResult.rows[0].count, 10);
    const totalPages = isPaginationProvided ? Math.ceil(totalUsers / limit) : 1;

    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No blocked users found.",
      });
    }

    const users = userQuery.rows.map(
      ({ password, otp, ...userWithoutSensitiveData }) =>
        userWithoutSensitiveData
    );

    return res.status(200).json({
      status: true,
      message: "Blocked users retrieved successfully",
      currentPage: isPaginationProvided ? page : 1,
      totalPages: totalPages,
      totalUsers: totalUsers,
      users: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getRecentlyDeletedUsers = async (req, res) => {
  try {
    const currentTimestamp = "CURRENT_TIMESTAMP";

    const deletedUsersQuery = `
      SELECT
        u.*,
        up.file_name, up.file_type,up.file_url,
        EXTRACT(DAY FROM (${currentTimestamp} - u.deleted_at)) AS days_since_deleted,
        90 - EXTRACT(DAY FROM (${currentTimestamp} - u.deleted_at)) AS remaining_days
      FROM
        users u
      LEFT JOIN uploads up ON u.uploads_id = up.id
      WHERE
        u.deleted_at IS NOT NULL
        AND u.deleted_at > (${currentTimestamp} - INTERVAL '90 days') AND u.role = 'user'
      ORDER BY
        u.deleted_at DESC
    `;

    const { rows } = await pool.query(deletedUsersQuery);

    // Remove the 'password' and 'OTP' fields from each user object
    const sanitizedUsers = rows.map((user) => {
      delete user.password;
      delete user.otp; // Replace 'otp' with the actual field name for OTP in your database
      return user;
    });

    // Filter out any users that might exceed the 90-day limit due to the time between the query and the current time.
    const usersWithinLimit = sanitizedUsers.filter(
      (user) => user.remaining_days >= 0
    );

    if (usersWithinLimit.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No recently deleted users found within the last 90 days.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Recently deleted users retrieved successfully.",
      result: usersWithinLimit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    const userExists = await pool.query("SELECT 1 FROM users WHERE id = $1", [
      userId,
    ]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found or already deleted",
      });
    }

    const result = await pool.query(
      "DELETE FROM  users WHERE id = $1 AND role = 'user' RETURNING *",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error while deleting",
      });
    }

    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.deleteAllUser = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM  users WHERE role = 'user' RETURNING *"
    );
    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "No users found to delete",
      });
    }
    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.updateProfile = async (req, res) => {
  const {
    user_id,
    full_name,
    gender,
    age,
    city,
    country,
    uploads_id,
    location,
  } = req.body;

  // Check for required fields
  if (!user_id) {
    return res.status(400).json({
      status: false,
      message: "user_id is required",
    });
  }

  try {
    // Check if the user exists
    const userQuery = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );

    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Check if the upload image exists
    if (uploads_id) {
      const uploadImage = await pool.query(
        "SELECT * FROM uploads WHERE id = $1",
        [uploads_id]
      );
      if (uploadImage.rowCount === 0) {
        return res.status(404).json({
          status: false,
          message: "Upload Image not found",
        });
      }
    }

    // Building the update query dynamically
    const fieldsToUpdate = [];
    const values = [];
    let queryIndex = 1;

    if (full_name !== undefined) {
      fieldsToUpdate.push(`full_name = $${queryIndex++}`);
      values.push(full_name);
    }
    if (gender !== undefined) {
      fieldsToUpdate.push(`gender = $${queryIndex++}`);
      values.push(gender);
    }
    if (age !== undefined) {
      fieldsToUpdate.push(`age = $${queryIndex++}`);
      values.push(age);
    }
    if (city !== undefined) {
      fieldsToUpdate.push(`city = $${queryIndex++}`);
      values.push(city);
    }
    if (country !== undefined) {
      fieldsToUpdate.push(`country = $${queryIndex++}`);
      values.push(country);
    }
    if (uploads_id !== undefined) {
      fieldsToUpdate.push(`uploads_id = $${queryIndex++}`);
      values.push(uploads_id);
    }
    if (location !== undefined) {
      fieldsToUpdate.push(`location = $${queryIndex++}`);
      values.push(location);
    }
    // Repeat for other fields (age, city, country, uploads_id, location)

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No update information provided",
      });
    }

    const updateQuery = `UPDATE users SET ${fieldsToUpdate.join(
      ", "
    )} WHERE id = $${queryIndex} RETURNING *`;
    values.push(user_id);

    // Perform the update
    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Error while updating data" });
    }

    delete result.rows[0].password;
    delete result.rows[0].otp;

    return res.json({
      status: true,
      message: "Profile updated successfully",
      result: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.updateBlockStatus = async (req, res) => {
  const { user_id, block_status } = req.body;
  try {
    if (!user_id || block_status == null) {
      return res.status(401).json({
        status: false,
        message: "Please provide user_id and block_status",
      });
    }

    const query = `UPDATE users SET block_status = $1 WHERE id = $2 RETURNING*`;
    const result = await pool.query(query, [block_status, user_id]);

    if (result.rowCount === 0) {
      return res.status(401).json({
        status: false,
        message: "User not found",
      });
    }
    delete result.rows[0].password;
    delete result.rows[0].otp;

    const status = block_status ? "Block" : "UnBlock";
    res.json({
      status: true,
      message: `User ${status} Successfully!`,
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
exports.getUsersByCountry = async (req, res) => {
  try {
    const { country } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : "ALL";
    const offset = limit !== "ALL" && !isNaN(page) ? (page - 1) * limit : 0;

    // Use ILIKE for case-insensitive matching and '%' for partial matching
    const countryPattern = `%${country}%`;

    // Count total users from the specified country (or partial match)
    const countQuery = `
      SELECT COUNT(*) FROM users 
      WHERE country ILIKE $1 AND deleted_at IS NULL
    `;
    const countResult = await pool.query(countQuery, [countryPattern]);
    const totalUsers = parseInt(countResult.rows[0].count, 10);

    if (totalUsers === 0) {
      return res.status(404).json({
        status: false,
        message: "No users found in this country",
      });
    }

    // Fetch users with pagination if limit is not 'ALL'
    let userQuery;
    if (limit === "ALL") {
      userQuery = await pool.query(
        "SELECT * FROM users WHERE country ILIKE $1 AND deleted_at IS NULL ORDER BY id",
        [countryPattern]
      );
    } else {
      userQuery = await pool.query(
        "SELECT * FROM users WHERE country ILIKE $1 AND deleted_at IS NULL ORDER BY id LIMIT $2 OFFSET $3",
        [countryPattern, limit, offset]
      );
    }

    const users = userQuery.rows.map(
      ({ password, otp, ...userWithoutPassword }) => userWithoutPassword
    );

    const totalPages = limit !== "ALL" ? Math.ceil(totalUsers / limit) : 1;

    res.json({
      status: true,
      message: "Users retrieved successfully",
      currentPage: limit !== "ALL" ? page : 1,
      totalPages,
      totalUsers,
      users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.addByMonthAndYear = async (req, res) => {
  try {
    const query = `
      SELECT 
        EXTRACT(YEAR FROM created_at) AS year, 
        EXTRACT(MONTH FROM created_at) AS month, 
        COUNT(*) AS user_count 
      FROM users 
      WHERE role = 'user'
      GROUP BY year, month
      ORDER BY year DESC, month DESC;
    `;

    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "No users found." });
    }

    res.json({
      status: true,
      message: "Users count by month and year retrieved successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

exports.search = async (req, res) => {
  const { name } = req.params;
  const id = parseInt(req.query.id);
  let { page, limit } = req.query;

  if (!name) {
    return res.status(400).json({
      status: false,
      message: "name is required",
    });
  }

  try {
    const searchWords = name.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) {
      return res
        .status(200)
        .json({ status: false, message: "No search words provided" });
    }

    const conditions = searchWords.map((word, index) => {
      return `(full_name ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    // Combine conditions for excluding reported and blocked users
    let exclusionCondition = "";
    if (id) {
      exclusionCondition = `AND id NOT IN (
        SELECT reported_user_id FROM report WHERE report_creator_id = $${
          conditions.length + 1
        }
      ) AND id NOT IN (
        SELECT block_user_id FROM block_users WHERE block_creator_id = $${
          conditions.length + 1
        } AND status = TRUE
      ) AND id NOT IN (
        SELECT block_creator_id FROM block_users WHERE block_user_id = $${
          conditions.length + 1
        } AND status = TRUE
      )`;
      values.push(id);
    }

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `SELECT * FROM users WHERE role = 'user' AND (${conditions.join(
        " OR "
      )}) ${exclusionCondition} ORDER BY id DESC LIMIT $${
        conditions.length + 2
      } OFFSET $${conditions.length + 3}`;
      values.push(limit, offset);
    } else {
      query = `SELECT * FROM users WHERE role = 'user' AND (${conditions.join(
        " OR "
      )}) ${exclusionCondition} ORDER BY id DESC`;
    }

    const result = await pool.query(query, values);

    if (result.rowCount < 1) {
      return res.status(200).json({
        status: true,
        message: "No result found",
        count: 0,
        result: [],
      });
    }

    res.json({
      status: true,
      message: "User retrieved successfully!",
      count: result.rowCount,
      result: result.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
