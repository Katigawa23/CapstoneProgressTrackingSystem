const express = require("express");
const cors = require("cors");

const { env } = require("./config/env");
const { backlogRouter } = require("./routes/backlog-routes");

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
  })
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "capstone-backend",
  });
});

app.use("/api/backlog-items", backlogRouter);

module.exports = {
  app,
};
