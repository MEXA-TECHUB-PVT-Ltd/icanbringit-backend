require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
require("./app/config/db.config");
const api = require("./app/routes/api");
const ejs = require("ejs");

const app = express();

app.set("view engine", "ejs");

const PORT = process.env.PORT || 3025;

app.use(cors());
app.use(express.json());

app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api", api);

// Route to preview email template
app.get("/email", (req, res) => {
  // This data would normally come from your database or user input
  const dataForEjs = {
    verificationCode: "1234", // Example verification code
    date: new Date().toLocaleDateString("en-US"), // Example date
    // Add other data you want to pass to the EJS template
  };

  // Define the path to your email template file
  const emailTemplatePath = path.join(
    __dirname,
    "app",
    "views",
    "emailVerification.ejs"
  );

  // Render the EJS template and send the HTML as a response
  ejs.renderFile(emailTemplatePath, dataForEjs, (err, htmlContent) => {
    if (err) {
      console.error(err); // Handle the error in a way that's appropriate for your app
      return res.status(500).send("Error rendering email template");
    }
    res.send(htmlContent); // Send the rendered HTML as the response
  });
});

app.get("/testing", (req, res) => {
  const emailTemplatePath = path.join(
    __dirname,
    "app",
    "views",
    "emailVerification.ejs"
  );

  // Render the EJS template and send the HTML as a response
  ejs.renderFile(
    emailTemplatePath,
    { verification_code: "1234" },
    (err, htmlContent) => {
      if (err) {
        console.error(err); // Handle the error in a way that's appropriate for your app
        return res.status(500).send("Error rendering email template");
      }
      res.send(htmlContent); // Send the rendered HTML as the response
    }
  );
});
app.get("/subscribe", (req, res) => {
  const emailTemplatePath = path.join(
    __dirname,
    "app",
    "views",
    "subscribe.ejs"
  );

  // Render the EJS template and send the HTML as a response
  ejs.renderFile(
    emailTemplatePath,
    { verification_code: "1234" },
    (err, htmlContent) => {
      if (err) {
        console.error(err); // Handle the error in a way that's appropriate for your app
        return res.status(500).send("Error rendering email template");
      }
      res.send(htmlContent); // Send the rendered HTML as the response
    }
  );
});

// app.get("/api/image", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "images", "logo_dark.png"));
// });

app.listen(PORT, () => console.log(`Application listening on ${PORT}`));
    