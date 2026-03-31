import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import express from "express";
import { router as coachRouter } from "./routes/coach";

// ── Validate required environment variables before anything else ────────────
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[LaunchPad API] Missing required environment variables: ${missing.join(", ")}`);
  console.error("Set these in your Railway dashboard under Variables.");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "LaunchPad API" });
});

// Schemes routes
app.get("/schemes", async (_req, res) => {
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .order("close_date", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/schemes/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Scheme not found" });
  res.json(data);
});

// Applications routes
app.get("/applications/:userId", async (req, res) => {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      *,
      schemes (
        employer,
        scheme_name,
        sector,
        salary_min,
        salary_max,
        close_date,
        apply_url
      )
    `,
    )
    .eq("user_id", req.params.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/applications", async (req, res) => {
  const { user_id, scheme_id, stage, deadline, notes } = req.body;

  if (!user_id || !scheme_id) {
    return res
      .status(400)
      .json({ error: "user_id and scheme_id are required" });
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id,
      scheme_id,
      stage: stage || "discovered",
      deadline,
      notes,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.patch("/applications/:id", async (req, res) => {
  const { stage, notes, deadline } = req.body;

  const { data, error } = await supabase
    .from("applications")
    .update({ stage, notes, deadline })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/applications/:id", async (req, res) => {
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Coach route
app.use("/coach", coachRouter);

// ── Catch unhandled errors so Railway logs show the real reason ──────────────
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
