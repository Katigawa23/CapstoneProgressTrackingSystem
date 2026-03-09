const { Pool } = require("pg");
const { env } = require("./env");

let backlogPool;

function shouldUseSsl(connectionString) {
  try {
    const { hostname, searchParams } = new URL(connectionString);
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    if (isLocalHost) {
      return false;
    }

    return searchParams.get("sslmode") !== "disable";
  } catch {
    return env.nodeEnv === "production";
  }
}

function createPool() {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add your database connection string to backend/.env."
    );
  }

  return new Pool({
    connectionString: env.databaseUrl,
    ssl: shouldUseSsl(env.databaseUrl) ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: env.nodeEnv !== "production",
  });
}

function getDb() {
  if (!backlogPool) {
    backlogPool = createPool();
  }

  return backlogPool;
}

module.exports = {
  getDb,
};
