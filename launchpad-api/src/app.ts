import dotenv from "dotenv";
dotenv.config();

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import cors from "cors";
import express from "express";
import { router as coachRouter } from "./routes/coach";

// ── Log missing env vars but don't exit — server must start for Railway ──────
export const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];
export const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[LaunchPad API] Missing env vars: ${missing.join(", ")}. ` +
    "Add them in Railway → Variables. API routes will return 503 until set."
  );
}

export const app = express();
app.use(express.json());

// ── CORS — restrict to known app origins ─────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://launchpad-production-93b3.up.railway.app",
  // Expo dev client uses no origin header, so we allow null/undefined in dev
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile app, curl, Railway health checks)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Supabase client ───────────────────────────────────────────────────────────
let supabase: SupabaseClient | null = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

function requireDb(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!supabase) {
    res.status(503).json({ error: "Database not configured — SUPABASE_URL / SUPABASE_ANON_KEY missing" });
    return;
  }
  next();
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    data: {
      status: "ok",
      app: "LaunchPad API",
      env: missing.length === 0 ? "all vars set" : `missing: ${missing.join(", ")}`,
    },
  });
});

// ── GET /schemes ──────────────────────────────────────────────────────────────
app.get("/schemes", requireDb, async (_req, res) => {
  console.log("[schemes] GET all");
  try {
    const { data, error } = await supabase!
      .from("schemes")
      .select("*")
      .order("close_date", { ascending: true });

    if (error) {
      console.error("[schemes] fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ data });
  } catch (err: any) {
    console.error("[schemes] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /schemes/:id ──────────────────────────────────────────────────────────
app.get("/schemes/:id", requireDb, async (req, res) => {
  const { id } = req.params;
  console.log("[schemes] GET id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    const { data, error } = await supabase!
      .from("schemes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[schemes] fetch by id error:", error.message);
      return res.status(404).json({ error: "Scheme not found" });
    }
    res.json({ data });
  } catch (err: any) {
    console.error("[schemes] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /applications/:userId ─────────────────────────────────────────────────
app.get("/applications/:userId", requireDb, async (req, res) => {
  const { userId } = req.params;
  console.log("[applications] GET userId:", userId);

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const { data, error } = await supabase!
      .from("applications")
      .select(
        `*, schemes (employer, scheme_name, sector, salary_min, salary_max, close_date, apply_url)`,
      )
      .eq("user_id", userId);

    if (error) {
      console.error("[applications] fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ data });
  } catch (err: any) {
    console.error("[applications] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /applications ────────────────────────────────────────────────────────
app.post("/applications", requireDb, async (req, res) => {
  const { user_id, scheme_id, stage, deadline, notes } = req.body;
  console.log("[applications] POST user:", user_id, "scheme:", scheme_id);

  if (!user_id || typeof user_id !== "string") {
    return res.status(400).json({ error: "user_id is required" });
  }
  if (!scheme_id || typeof scheme_id !== "string") {
    return res.status(400).json({ error: "scheme_id is required" });
  }

  const VALID_STAGES = ["discovered", "applied", "online_test", "video_interview", "assessment_centre", "offer", "rejected"];
  const resolvedStage = stage || "discovered";
  if (!VALID_STAGES.includes(resolvedStage)) {
    return res.status(400).json({ error: `stage must be one of: ${VALID_STAGES.join(", ")}` });
  }

  try {
    const { data, error } = await supabase!
      .from("applications")
      .insert({ user_id, scheme_id, stage: resolvedStage, deadline, notes })
      .select()
      .single();

    if (error) {
      console.error("[applications] insert error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    console.log("[applications] created id:", data.id);
    res.status(201).json({ data });
  } catch (err: any) {
    console.error("[applications] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /applications/:id ───────────────────────────────────────────────────
app.patch("/applications/:id", requireDb, async (req, res) => {
  const { id } = req.params;
  const { stage, notes, deadline } = req.body;
  console.log("[applications] PATCH id:", id, "stage:", stage);

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "id is required" });
  }

  const VALID_STAGES = ["discovered", "applied", "online_test", "video_interview", "assessment_centre", "offer", "rejected"];
  if (stage !== undefined && !VALID_STAGES.includes(stage)) {
    return res.status(400).json({ error: `stage must be one of: ${VALID_STAGES.join(", ")}` });
  }

  const updates: Record<string, unknown> = {};
  if (stage !== undefined) updates.stage = stage;
  if (notes !== undefined) updates.notes = notes;
  if (deadline !== undefined) updates.deadline = deadline;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const { data, error } = await supabase!
      .from("applications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[applications] update error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ data });
  } catch (err: any) {
    console.error("[applications] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /applications/:id ──────────────────────────────────────────────────
app.delete("/applications/:id", requireDb, async (req, res) => {
  const { id } = req.params;
  console.log("[applications] DELETE id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    const { error } = await supabase!
      .from("applications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[applications] delete error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.status(204).send();
  } catch (err: any) {
    console.error("[applications] unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Coach route ───────────────────────────────────────────────────────────────
app.use("/coach", coachRouter);
