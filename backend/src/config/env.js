const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getEnv(name, fallback) {
  const value = process.env[name];

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return fallback;
}

module.exports = {
  env: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    port: Number(getEnv("PORT", "4000")),
    frontendOrigin: getEnv("FRONTEND_ORIGIN", "http://localhost:3000"),
    databaseUrl: getEnv("DATABASE_URL", ""),
  },
};
