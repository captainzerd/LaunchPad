import { app } from "./app";

// ── Global error handlers ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[LaunchPad API] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[LaunchPad API] Unhandled rejection:", reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`LaunchPad API running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("[LaunchPad API] Server error:", err);
  process.exit(1);
});
