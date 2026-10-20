import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { app } from "./app.js";
import { initializeDatabase } from "./db.js";

async function startServer(): Promise<void> {
  await initializeDatabase();
  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV === "production") {
    const clientDirectory = path.resolve(process.cwd(), "dist/client");
    app.use(express.static(clientDirectory, { index: false }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api/") || request.path === "/_app/health") {
        next();
        return;
      }
      response.sendFile(path.join(clientDirectory, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  } else {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Entrepreneur Test server listening on port ${port}.`);
  });
}

void startServer().catch(() => {
  console.error("Entrepreneur Test server startup failed.");
  process.exit(1);
});
