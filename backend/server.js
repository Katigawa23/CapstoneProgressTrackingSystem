const http = require("http");

const PORT = process.env.PORT || 4000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const { method, url } = request;

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (method === "GET" && url === "/") {
    sendJson(response, 200, {
      message: "Node.js backend is running",
    });
    return;
  }

  if (method === "GET" && url === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "capstone-backend",
    });
    return;
  }

  sendJson(response, 404, {
    error: "Route not found",
  });
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
