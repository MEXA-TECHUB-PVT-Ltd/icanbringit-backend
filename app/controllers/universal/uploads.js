const { pool } = require("../../config/db.config");

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "File is required.",
    });
  }

  const file = req.file;
  console.log(file);

  let fileUrl;

  // Check if the file is uploaded to Cloudinary
  if (
    file.path &&
    (file.path.startsWith("http://") || file.path.startsWith("https://"))
  ) {
    fileUrl = file.path;
  } else {
    fileUrl = `${process.env.SERVER_URL}/public/uploads/${file.filename}`;
  }

  try {
    const result = await pool.query(
      "INSERT INTO uploads (file_name, file_type, file_url) VALUES ($1, $2, $3) RETURNING *",
      [file.originalname, file.mimetype, fileUrl]
    );

    const response = {
      id: result.rows[0].id,
      file_name: result.rows[0].file_name,
      file_type: result.rows[0].file_type,
      file_url: result.rows[0].file_url,
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
