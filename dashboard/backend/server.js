const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

let latestData = {}; // store latest ESP32 data

// === POST route to receive data from ESP32 ===
app.post("/data", (req, res) => {
  latestData = req.body;
  console.log("✅ Data received:", latestData);
  res.json({ status: "success" });
});

// === GET route to send data to frontend ===
app.get("/latest", (req, res) => {
  res.json(latestData);
});

// === Start server ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
});
