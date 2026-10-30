import { createHash, timingSafeEqual } from "node:crypto";

function equalSecret(left, right) {
  const hash = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(left), hash(right));
}

export function createAccessGuard({
  username = "admin",
  password = "",
  production = false,
} = {}) {
  if (production && password.length < 16)
    throw new Error(
      "Production requires APP_AUTH_PASSWORD with at least 16 characters.",
    );
  if (password && password.length < 16)
    throw new Error("APP_AUTH_PASSWORD must have at least 16 characters.");
  return (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    const path = new URL(request.url, "http://localhost").pathname;
    if (!password || path === "/api/health") return true;
    const header = request.headers.authorization || "";
    const decoded = header.startsWith("Basic ")
      ? Buffer.from(header.slice(6), "base64").toString("utf8")
      : "";
    const separator = decoded.indexOf(":");
    if (
      separator >= 0 &&
      equalSecret(decoded.slice(0, separator), username) &&
      equalSecret(decoded.slice(separator + 1), password)
    )
      return true;
    response.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Research Graph", charset="UTF-8"',
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ message: "Authentication required." }));
    return false;
  };
}
