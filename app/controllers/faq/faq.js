const { pool } = require("../../config/db.config");

exports.add = async (req, res) => {
  const { question, answer } = req.body;

  // Validation: Ensure both question and answer are provided
  if (!question || !answer) {
    return res.status(400).json({
      status: false,
      message: "Both question and answer are required.",
    });
  }

  try {
    // Check if this question-answer pair already exists
    const checkQuery = `
      SELECT * FROM faq WHERE question = $1 AND answer = $2;
    `;
    const checkResult = await pool.query(checkQuery, [question, answer]);
    if (checkResult.rowCount > 0) {
      return res
        .status(400)
        .json({ status: false, message: "This FAQ entry already exists." });
    }

    const query = `
      INSERT INTO faq (question, answer) 
      VALUES ($1, $2) 
      RETURNING *
    `;

    const result = await pool.query(query, [question, answer]);

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "Error in inserting data into FAQ table.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ added successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  const { id, question, answer } = req.body;

  if (!id || !question || !answer) {
    return res.status(400).json({
      status: false,
      message: "id, question, and answer are required.",
    });
  }

  try {
    // Check if the FAQ with the specified id exists
    const faqExists = await pool.query("SELECT id FROM faq WHERE id = $1", [
      id,
    ]);
    if (faqExists.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "FAQ not found.",
      });
    }

    const query = `
      UPDATE faq
      SET question = $2, answer = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, question, answer, created_at, updated_at;
    `;

    const result = await pool.query(query, [id, question, answer]);

    return res.status(200).json({
      status: true,
      message: "FAQ updated successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.getAll = async (req, res) => {
  let { limit = 10, page = 1 } = req.query;

  // Convert limit and page to integers and validate
  limit = parseInt(limit);
  page = parseInt(page);
  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      status: false,
      message: "Invalid limit or page. Please provide positive integer values.",
    });
  }

  try {
    const offset = (page - 1) * limit;

    const query = `
      SELECT id, question, answer, created_at, updated_at
      FROM faq
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await pool.query(query, [limit, offset]);

    const countQuery = "SELECT COUNT(*) FROM faq";
    const totalFAQsCount = parseInt(
      (await pool.query(countQuery)).rows[0].count
    );
    const totalPages = Math.ceil(totalFAQsCount / limit);

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "No FAQs found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQs retrieved successfully!",
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalFAQsCount,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      result: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.get = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id is required.",
    });
  }

  try {
    const query = `
            SELECT id, question, answer, created_at, updated_at
            FROM faq
            WHERE id = $1;
        `;

    const result = await pool.query(query, [id]);

    if (result.rowCount < 1) {
      return res.json({
        status: false,
        message: "FAQ not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ retrieved successfully!",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      status: false,
      message: "id is required.",
    });
  }

  try {
    // Delete the specific FAQ
    const result = await pool.query(
      "DELETE FROM faq WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount < 1) {
      return res.status(404).json({
        status: false,
        message: "FAQ not found.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "FAQ deleted successfully.",
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM faq RETURNING *");

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "No FAQs found to delete.",
      });
    }

    return res.status(200).json({
      status: true,
      message: `All FAQs deleted successfully.`,
      result: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.search = async (req, res) => {
  const { query: search } = req.params;
  let { page, limit } = req.query;

  if (!search) {
    return res.status(400).json({
      status: false,
      message: "search is required",
    });
  }

  try {
    const searchWords = search.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) {
      return res
        .status(200)
        .json({ status: false, message: "No search words provided" });
    }

    const conditions = searchWords.map((word, index) => {
      return `(question ILIKE $${index + 1})`;
    });

    const values = searchWords.map((word) => `%${word.toLowerCase()}%`);
    let query, offset;

    if (page && limit) {
      limit = parseInt(limit);
      offset = (parseInt(page) - 1) * limit;
      query = `SELECT * FROM faq WHERE (${conditions.join(
        " OR "
      )}) ORDER BY id DESC LIMIT $${conditions.length + 1} OFFSET $${
        conditions.length + 2
      }`;
      values.push(limit, offset);
    } else {
      query = `SELECT * FROM faq WHERE (${conditions.join(
        " OR "
      )}) ORDER BY id DESC`;
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
      message: "Event retrieved successfully!",
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
