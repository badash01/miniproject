import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createAccessGuard } from "../lib/access.js";

test("production refuses to boot without a strong access password", () => {
  assert.throws(
    () => createAccessGuard({ production: true }),
    /APP_AUTH_PASSWORD/,
  );
  assert.throws(
    () => createAccessGuard({ password: "short" }),
    /16 characters/,
  );
});

test("hosted access protects pages, APIs and preflight requests while allowing health checks", async () => {
  const password = "test-password-123456";
  const guard = createAccessGuard({ production: true, password });
  const server = createServer((req, res) => {
    if (guard(req, res)) {
      res.writeHead(200);
      res.end("ok");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of [
      "/",
      "/app.js",
      "/api/documents",
      "/api/graph",
      "/api/ask",
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 401);
      assert.match(response.headers.get("www-authenticate"), /Basic/);
    }
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal(
      (await fetch(base + "/api/documents", { method: "OPTIONS" })).status,
      401,
    );
    for (const credentials of [
      "wrong:password",
      "admin:wrong-password",
      "invalid",
    ]) {
      assert.equal(
        (
          await fetch(base + "/api/documents", {
            headers: {
              Authorization:
                "Basic " + Buffer.from(credentials).toString("base64"),
            },
          })
        ).status,
        401,
      );
    }
    const response = await fetch(base + "/api/documents", {
      headers: {
        Authorization:
          "Basic " + Buffer.from("admin:" + password).toString("base64"),
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
