const hooks = require("hooks");

const PUBLIC_PATHS = new Set(["/status", "/mcp-ui-proxy", "/mcp-app-proxy"]);

const getPathFromUri = (uri) => {
  try {
    const parsed = new URL(uri);
    return parsed.pathname;
  } catch {
    return uri.split("?")[0];
  }
};

hooks.beforeEach((transaction, done) => {
  const path = getPathFromUri(transaction.fullPath || transaction.request.uri || "");
  const expectedStatus = String(transaction.expected.statusCode || "");

  if (!expectedStatus.startsWith("2")) {
    transaction.skip = true;
    done();
    return;
  }

  if (path === "/mcp-ui-proxy" || path === "/recipes/save") {
    transaction.skip = true;
    done();
    return;
  }

  if (!PUBLIC_PATHS.has(path)) {
    transaction.request.headers["X-Secret-Key"] = "dev-secret";
  }

  if (path === "/mcp-ui-proxy" && !transaction.request.uri.includes("secret=")) {
    const separator = transaction.request.uri.includes("?") ? "&" : "?";
    transaction.request.uri += `${separator}secret=dev-secret`;
  } else if (path === "/mcp-ui-proxy") {
    transaction.request.uri = transaction.request.uri.replace(/secret=[^&]*/g, "secret=dev-secret");
  }

  if (transaction.expected.headers) {
    const expectedContentType =
      transaction.expected.headers["Content-Type"] ?? transaction.expected.headers["content-type"];
    if (expectedContentType === "application/json") {
      transaction.expected.headers["Content-Type"] = "application/json; charset=utf-8";
      transaction.expected.headers["content-type"] = "application/json; charset=utf-8";
    }
  }

  if (path === "/reply") {
    transaction.skip = true;
  }

  done();
});
