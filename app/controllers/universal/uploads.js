const { pool } = require("../../config/db.config");

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "File is required.",
    });
  }

  const extension = req.file.filename;
  const splitName = extension.split(".");
  const type = splitName[splitName.length - 1];

  try {
    const result = await pool.query(
      "INSERT INTO uploads (file_name, file_type) VALUES ($1, $2) RETURNING *",
      [req.file.filename, type]
    );

    const response = {
      id: result.rows[0].id,
      file_name:
        process.env.SERVER_URL + "/public/uploads/" + result.rows[0].file_name,
      file_type: result.rows[0].file_type,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
    };

    res.status(200).json({
      status: true,
      message: "File uploaded successfully.",
      result: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};
