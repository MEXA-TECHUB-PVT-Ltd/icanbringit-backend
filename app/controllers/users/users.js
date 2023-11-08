const { pool } = require("../../config/db.config");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../../lib/sendEmail");
const sendOtp = require("../../util/sendOtp");

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

    if (signup_type === "email") {
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
    }

    switch (signup_type) {
      case "email":
        const otp = crypto.randomInt(1000, 9999);
        // Insert email user logic
        const hashedPassword = await bcrypt.hash(password, 8);
        insertQuery =
          "INSERT INTO users (email, password, role, signup_type, otp) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, signup_type";
        insertValues = [email, hashedPassword, userRole, signup_type, otp];
        const emailSent = await sendEmail(
          email,
          "Sign Up Verification",
          `Thanks for signing up. Your code to verify is: ${otp}`
        );
        if (!emailSent.success) {
          return res.status(500).json({
            status: false,
            message: emailSent.message,
          });
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
          "INSERT INTO users (google_access_token, role, signup_type) VALUES ($1, $2, $3) RETURNING id";
        insertValues = [google_access_token, userRole, signup_type];
        break;
      case "apple":
        if (!apple_access_token) {
          return res.status(400).json({
            status: false,
            message: "Apple access token is required",
          });
        }
        insertQuery =
          "INSERT INTO users (apple_access_token, role, signup_type) VALUES ($1, $2, $3) RETURNING id";
        insertValues = [apple_access_token, userRole, signup_type];
        break;
      default:
        return res.status(400).json({
          status: false,
          message: "Invalid signup type",
        });
    }

    const newUser = await pool.query(insertQuery, insertValues);
    userId = newUser.rows[0].id;

    const response = {
      status: true,
      message: "We have sent you verification code",
      result: {
        user: {
          id: userId,
          role: userRole,
          signup_type,
        },
      },
    };

    if (signup_type === "email") {
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: 86400, // 24 hours
      });

      response.result.user.email = email;
      response.result.token = token;
      // response.note = "We have sent you verification code";
    }

    return res.status(201).json(response);
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

  if ((!email || !otp)) {
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
    return res
      .status(200)
      .json({ status: true, message: "Otp verified successfully" });
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
      result: result.rows[0]
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
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query("SELECT COUNT(*) FROM users");
    const total = parseInt(countResult.rows[0].count, 10);

    if (total === 0) {
      return res.status(200).json({
        status: true,
        message: "No users found",
        users: [],
        currentPage: page,
        totalPages: 0,
        totalUsers: total,
      });
    }

    const userQuery = await pool.query(
      "SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    const users = userQuery.rows.map((user) => {
      const { password, otp, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return res.status(200).json({
      status: true,
      message: "Users retrieved successfully",
      currentPage: page,
      totalPages: totalPages,
      totalUsers: total,
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

    // Filter out any users that might exceed the 90-day limit due to the time between the query and the current time.
    const usersWithinLimit = rows.filter((user) => user.remaining_days >= 0);

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




