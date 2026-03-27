"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabase_js_1 = require("@supabase/supabase-js");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const coach_1 = require("./routes/coach");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
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
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.get("/schemes/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("schemes")
        .select("*")
        .eq("id", req.params.id)
        .single();
    if (error)
        return res.status(404).json({ error: "Scheme not found" });
    res.json(data);
});
// Applications routes
app.get("/applications/:userId", async (req, res) => {
    const { data, error } = await supabase
        .from("applications")
        .select(`
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
    `)
        .eq("user_id", req.params.userId);
    if (error)
        return res.status(500).json({ error: error.message });
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
    if (error)
        return res.status(500).json({ error: error.message });
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
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.delete("/applications/:id", async (req, res) => {
    const { error } = await supabase
        .from("applications")
        .delete()
        .eq("id", req.params.id);
    if (error)
        return res.status(500).json({ error: error.message });
    res.status(204).send();
});
// Coach route
app.use("/coach", coach_1.router);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LaunchPad API running on port ${PORT}`);
});
