const { pool } = require("../../config/db.config");

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "File is required.",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO uploads (file_name, file_type) VALUES ($1, $2) RETURNING *",
      [req.file.filename, req.body.image_type]
    );

    res.status(200).json({
      status: true,
      message: "File uploaded successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};
