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

exports.create = async (req, res) => {
  const {
    email,
    password,
    signup_type,
    role,
    google_access_token,
    apple_access_token,
  } = req.body;

  if (!signup_type) {
    return res.status(400).json({
      status: false,
      message: "Signup type is required",
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
          "INSERT INTO users (email, password, role, signup_type, otp) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        insertValues = [email, hashedPassword, userRole, signup_type, otp];
        // const emailSent = await sendEmail(
        //   email,
        //   "Sign Up Verification",
        //   `Thanks for signing up. Your code to verify is: ${otp}`
        // );
        // // Render the EJS template to a string
        // const emailTemplatePath = path.join(
        //   __dirname,
        //   "..",
        //   "..",
        //   "views",
        //   "emailVerification.ejs"
        // );
        // const dataForEjs = {
        //   verificationCode: otp,
        //   date: new Date().toLocaleDateString("en-US"),
        // };

        // ejs.renderFile(
        //   emailTemplatePath,
        //   dataForEjs,
        //   async (err, htmlContent) => {
        //     if (err) {
        //       console.log(err); // Handle error appropriately
        //       return res.status(500).json({
        //         status: false,
        //         message: "Error rendering email template",
        //       });
        //     } else {
        //       // Use the rendered HTML content for the email
        //       const emailSent = await sendEmail(
        //         email,
        //         "Sign Up Verification",
        //         htmlContent
        //       );

        //       if (!emailSent.success) {
        //         return res.status(500).json({
        //           status: false,
        //           message: emailSent.message,
        //         });
        //       }
        //     }
        //   }
        // );
        break;
      case "google":
        if (!google_access_token) {
          return res.status(400).json({
            status: false,
            message: "Google access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (email, google_access_token, role, signup_type) VALUES ($1, $2, $3, $4) RETURNING *";
        insertValues = [email, google_access_token, userRole, signup_type];
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
    delete newUser.rows[0].otp;

    const response = {
      status: true,
      message: "We have sent you verification code",
      result: newUser.rows[0],
    };

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: 86400, // 24 hours
    });

    response.result.token = token;

    return sendSuccessResponse(
      res,
      "Users retrieved successfully",
      { response },
      201
    );
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
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ status: false, message: "email and otp are required" });
  }

  try {
    const checkUserExists = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User not found",
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
  const { email } = req.body;
  if (!email) {
    return res.status(404).json({ message: "Email is required!" });
  }
  try {
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
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
  const { email, new_password } = req.body;
  try {
    if (!email || !new_password) {
      return res.status(401).json({
        status: false,
        message: "email and new_password are required",
      });
    }
    const findUserQuery = `SELECT * FROM users WHERE email = $1`;
    const findUser = await pool.query(findUserQuery, [email]);
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

exports.updatePassword = async (req, res) => {
  const { email, old_password, new_password } = req.body;
  try {
    if (!email || !old_password || !new_password) {
      return res.status(401).json({
        status: false,
        message: "email, old_password and new_password are required",
      });
    }
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
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
    await pool.query(query, [hash, email]);
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
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ status: false, message: "email and password are required" });
  }
  try {
    const checkUserExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (checkUserExists.rowCount === 0) {
      return res.status(409).json({
        status: false,
        message: "User already exists with this email",
      });
    }
    const isMatch = await bcrypt.compare(
      password,
      checkUserExists.rows[0].password
    );
    if (!isMatch) {
      return res.status(401).json({
        status: false,
        message: "Invalid Credentials",
      });
    }
    const token = jwt.sign(
      { id: checkUserExists.rows[0].id },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );

    delete checkUserExists.rows[0].password;
    delete checkUserExists.rows[0].otp;

    return res.status(200).json({
      status: true,
      message: "Sign in successfully!",
      result: checkUserExists.rows[0],
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
    const userQuery = await pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);

    if (userQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    delete userQuery.rows[0].password;
    delete userQuery.rows[0].otp;

    return res.status(200).json({
      status: true,
      message: "User retrieved successfully",
      user: userQuery.rows[0],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page, limit, offset, total, totalPages } =
      await getPaginatedResults(req, "users");

    if (total === 0) {
      return sendSuccessResponse(res, "No users found", {
        users: [],
        currentPage: page,
        totalPages: 0,
        totalUsers: total,
      });
    }

    const userQuery = await pool.query(
      "SELECT * FROM users WHERE deleted_at IS NULL  ORDER BY id LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const users = userQuery.rows.map(
      ({ password, otp, ...userWithoutPassword }) => userWithoutPassword
    );

    sendSuccessResponse(res, "Users retrieved successfully", {
      currentPage: page,
      totalPages,
      totalUsers: total,
      users,
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
        *,
        EXTRACT(DAY FROM (${currentTimestamp} - deleted_at)) AS days_since_deleted,
        90 - EXTRACT(DAY FROM (${currentTimestamp} - deleted_at)) AS remaining_days
      FROM
        users
      WHERE
        deleted_at IS NOT NULL
        AND deleted_at > (${currentTimestamp} - INTERVAL '90 days')
      ORDER BY
        deleted_at DESC
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
      users: usersWithinLimit,
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
    const userExists = await pool.query(
      "SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );
    if (userExists.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found or already deleted",
      });
    }

    await pool.query(
      "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );

    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

// ! user bio

exports.addBio = async (req, res) => {
  const { user_id, full_name, gender, age, city, country, uploads_id } =
    req.body;

  // Check for required fields
  if (!user_id || !full_name || !gender || !age || !city || !country) {
    return res.status(400).json({
      status: false,
      message: "user_id, full_name, gender, age, city, country are required",
    });
  }

  try {
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
    const uploadsQuery = await pool.query(
      "SELECT * FROM uploads WHERE id = $1 ",
      [uploads_id]
    );

    if (uploads_id && uploadsQuery.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Image not found",
      });
    }
    const query = `INSERT INTO user_bio (user_id, full_name, gender, age, city, country, uploads_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`;

    const result = await pool.query(query, [
      user_id,
      full_name,
      gender,
      age,
      city,
      country,
      uploads_id || null,
    ]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Error while inserting data" });
    }

    return res.json({
      status: true,
      message: "Bio added successfully",
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

exports.updateBio = async (req, res) => {
  const { user_id, full_name, gender, age, city, country, uploads_id } =
    req.body;

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

    // Prepare the update statement
    let updateQuery = "UPDATE user_bio SET ";
    const queryParams = [];
    let paramCount = 1;

    if (full_name) {
      queryParams.push(full_name);
      updateQuery += `full_name = $${paramCount}, `;
      paramCount++;
    }
    if (gender) {
      queryParams.push(gender);
      updateQuery += `gender = $${paramCount}, `;
      paramCount++;
    }
    if (age) {
      queryParams.push(age);
      updateQuery += `age = $${paramCount}, `;
      paramCount++;
    }
    if (city) {
      queryParams.push(city);
      updateQuery += `city = $${paramCount}, `;
      paramCount++;
    }
    if (country) {
      queryParams.push(country);
      updateQuery += `country = $${paramCount}, `;
      paramCount++;
    }
    if (uploads_id) {
      queryParams.push(uploads_id);
      updateQuery += `uploads_id = $${paramCount}, `;
      paramCount++;
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Add the WHERE clause
    queryParams.push(user_id);
    updateQuery += ` WHERE user_id = $${paramCount} RETURNING *`;

    // Perform the update
    const result = await pool.query(updateQuery, queryParams);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Error while updating data" });
    }

    return res.json({
      status: true,
      message: "Bio updated successfully",
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

exports.getUserBio = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    // Query to join user_bio and uploads table
    const query = `
      SELECT ub.id, ub.user_id, ub.full_name, ub.gender, ub.age, ub.city, ub.country, 
             u.file_name, u.file_type, u.created_at as upload_created_at
      FROM user_bio ub
      LEFT JOIN uploads u ON ub.uploads_id = u.id
      WHERE ub.user_id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User bio not found",
      });
    }

    return res.json({
      status: true,
      message: "User bio retrieved successfully",
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

exports.addEventType = async (req, res) => {
  const { text, options } = req.body;

  // Check for required fields
  if (!text || options.length === 0) {
    return res.status(400).json({
      status: false,
      message: "Text and options are required",
    });
  }

  try {
    // SQL query to insert a new event type
    const query = `
      INSERT INTO event_types (text, options)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await pool.query(query, [text, options || []]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in adding event type",
      });
    }

    return res.status(201).json({
      status: true,
      message: "Event type added successfully",
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

exports.updateEventType = async (req, res) => {
  const { id, text, options } = req.body;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Event type ID is required",
    });
  }

  try {
    // Prepare the update statement
    let updateQuery = "UPDATE event_types SET ";
    const queryParams = [];
    let paramCount = 1;

    if (text) {
      queryParams.push(text);
      updateQuery += `text = $${paramCount}, `;
      paramCount++;
    }
    if (options) {
      queryParams.push(options);
      updateQuery += `options = $${paramCount}, `;
      paramCount++;
    }

    // Remove the last comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Append the WHERE clause to target the specific event type
    queryParams.push(id);
    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;

    // Execute the update query
    const result = await pool.query(updateQuery, queryParams);

    // Check if the update was successful
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Event type not found or no changes made",
      });
    }

    // Respond with success message
    return res.json({
      status: true,
      message: "Event type updated successfully",
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


exports.getEventType = async (req, res) => {
  const { id } = req.params;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Event type ID is required",
    });
  }

  try {
    const query = "SELECT * FROM event_types WHERE id = $1";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Event type not found",
      });
    }

    return res.json({
      status: true,
      message: "Event type retrieved successfully",
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


exports.getAllEventTypes = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query = "SELECT * FROM event_types ORDER BY id LIMIT $1 OFFSET $2";
    const countQuery = "SELECT COUNT(*) FROM event_types";

    // Execute queries
    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    return res.json({
      status: true,
      message: "Event types retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};



exports.deleteEventType = async (req, res) => {
  const { id } = req.params;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Event type ID is required",
    });
  }

  try {
    const query = "DELETE FROM event_types WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Event type not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "Event type deleted successfully",
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


exports.deleteAllEventTypes = async (req, res) => {
  try {
    const query = "DELETE FROM event_types RETURNING *";
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No event types found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All event types deleted successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};



exports.getUserBio = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "User ID is required",
    });
  }

  try {
    // Query to join user_bio and uploads table
    const query = `
      SELECT ub.id, ub.user_id, ub.full_name, ub.gender, ub.age, ub.city, ub.country, 
             u.file_name, u.file_type, u.created_at as upload_created_at
      FROM user_bio ub
      LEFT JOIN uploads u ON ub.uploads_id = u.id
      WHERE ub.user_id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "User bio not found",
      });
    }

    return res.json({
      status: true,
      message: "User bio retrieved successfully",
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


// ! food preference
exports.addFoodPref = async (req, res) => {
  const { text, options } = req.body;

  // Check for required fields
  if (!text || options.length === 0) {
    return res.status(400).json({
      status: false,
      message: "Text and options are required",
    });
  }

  try {
    // SQL query to insert a new event type
    const query = `
      INSERT INTO food_preference (text, options)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await pool.query(query, [text, options || []]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: false,
        message: "Error in adding food_preference",
      });
    }

    return res.status(201).json({
      status: true,
      message: "food_preference added successfully",
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




exports.updateFoodPref = async (req, res) => {
  const { id, text, options } = req.body;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "food_preference ID is required",
    });
  }

  try {
    // Prepare the update statement
    let updateQuery = "UPDATE food_preference SET ";
    const queryParams = [];
    let paramCount = 1;

    if (text) {
      queryParams.push(text);
      updateQuery += `text = $${paramCount}, `;
      paramCount++;
    }
    if (options) {
      queryParams.push(options);
      updateQuery += `options = $${paramCount}, `;
      paramCount++;
    }

    // Remove the last comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Append the WHERE clause to target the specific event type
    queryParams.push(id);
    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;

    // Execute the update query
    const result = await pool.query(updateQuery, queryParams);

    // Check if the update was successful
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "food_preference not found or no changes made",
      });
    }

    // Respond with success message
    return res.json({
      status: true,
      message: "food_preference updated successfully",
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

exports.getFoodPref = async (req, res) => {
  const { id } = req.params;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "food_preference is required",
    });
  }

  try {
    const query = "SELECT * FROM food_preference WHERE id = $1";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "food_preference not found",
      });
    }

    return res.json({
      status: true,
      message: "food_preference retrieved successfully",
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

exports.getAllFoodPref = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const query =
      "SELECT * FROM food_preference ORDER BY id LIMIT $1 OFFSET $2";
    const countQuery = "SELECT COUNT(*) FROM event_types";

    // Execute queries
    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query(countQuery);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    return res.json({
      status: true,
      message: "food_preference retrieved successfully",
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

exports.deleteFoodPref = async (req, res) => {
  const { id } = req.params;

  // Check if the event type ID is provided
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "food_preference ID is required",
    });
  }

  try {
    const query = "DELETE FROM food_preference WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "food_preference not found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "food_preference deleted successfully",
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

exports.deleteAllFoodPref = async (req, res) => {
  try {
    const query = "DELETE FROM food_preference RETURNING *";
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No food_preference found or already deleted",
      });
    }

    return res.json({
      status: true,
      message: "All food_preference deleted successfully",
      result: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};
