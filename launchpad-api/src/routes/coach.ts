import dotenv from "dotenv";
dotenv.config();

import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

// ── Rate limit: 20 requests per minute per IP ─────────────────────────────────
const coachLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment before trying again." },
});

router.use(coachLimiter);

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type UserProfile = {
  full_name?: string;
  university?: string;
  degree?: string;
  graduation_year?: string | number;
  target_sectors?: string[];
};

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  "CV Review":
    "You are LaunchPad Coach, a UK graduate careers specialist. Review CVs and give specific, actionable feedback for UK graduate scheme applications. Be encouraging but honest. Focus on: ATS compatibility, achievement-focused bullet points using action verbs, and sector-specific requirements. Format feedback clearly with sections.",
  "Mock Interview":
    "You are LaunchPad Coach, a UK graduate interview specialist. Ask realistic UK graduate scheme interview questions one at a time and give detailed feedback on answers using the STAR framework. Cover competency, strength-based, and commercial awareness questions. Start by asking the first question.",
  "Application Q":
    "You are LaunchPad Coach, a UK graduate application specialist. Help students write and improve answers to graduate scheme application questions using the STAR and CAR frameworks. Give specific rewrites and improvements. Be direct and practical.",
  "Psychometric Tips":
    "You are LaunchPad Coach, a psychometric test specialist. Give practical tips and practice strategies for UK graduate scheme psychometric tests including numerical, verbal, logical reasoning and situational judgement tests. Give example questions where helpful.",
  "Assessment Centre":
    "You are LaunchPad Coach, a UK assessment centre specialist. Help students prepare for graduate scheme assessment centres including group exercises, case studies, presentations and in-tray exercises. Give concrete strategies and examples.",
};

const VALID_COACHING_TYPES = Object.keys(SYSTEM_PROMPTS);

// ── POST /coach ───────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { message, coachingType, history, userProfile } = req.body as {
    message: unknown;
    coachingType: unknown;
    history: unknown;
    userProfile: unknown;
  };

  console.log("[coach] POST type:", coachingType, "messageLength:", typeof message === "string" ? message.length : 0);

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "message is required" });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: "message must be 4000 characters or fewer" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[coach] ANTHROPIC_API_KEY not set");
    return res.status(503).json({ error: "AI service not configured" });
  }

  // Validate and normalise history
  const rawHistory = Array.isArray(history) ? history : [];
  const validatedHistory: HistoryMessage[] = rawHistory
    .filter(
      (h): h is HistoryMessage =>
        h !== null &&
        typeof h === "object" &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.content === "string",
    )
    .slice(-20); // cap at last 20 turns to control token spend

  // Anthropic requires conversations to start with a user turn.
  // Drop any leading assistant messages (e.g. the UI starter greeting).
  while (validatedHistory.length > 0 && validatedHistory[0].role === "assistant") {
    validatedHistory.shift();
  }

  // ── Build system prompt ─────────────────────────────────────────────────────
  const resolvedType =
    typeof coachingType === "string" && VALID_COACHING_TYPES.includes(coachingType)
      ? coachingType
      : "CV Review";

  const basePrompt = SYSTEM_PROMPTS[resolvedType];

  let userContext = "";
  if (userProfile && typeof userProfile === "object") {
    const p = userProfile as UserProfile;
    const name = p.full_name || "The user";
    const sectors =
      Array.isArray(p.target_sectors) && p.target_sectors.length > 0
        ? p.target_sectors.join(", ")
        : "various sectors";
    userContext =
      `\n\nUser context: ${name} is a ${p.graduation_year ?? ""} student at ${p.university ?? "university"} ` +
      `studying ${p.degree ?? "an unknown subject"}, targeting ${sectors}.`;
  }

  const systemPrompt = basePrompt + userContext;

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages: Anthropic.MessageParam[] = [
      ...validatedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message.trim() },
    ];

    console.log("[coach] calling Anthropic,", messages.length, "messages, type:", resolvedType);

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    console.log("[coach] Anthropic response received, stop_reason:", completion.stop_reason);

    const responseText =
      completion.content[0].type === "text"
        ? completion.content[0].text
        : "Sorry, I could not generate a response";

    res.json({ data: { response: responseText } });
  } catch (err: any) {
    console.error("[coach] Anthropic error:", err.message);
    res.status(500).json({ error: "AI service error — please try again" });
  }
});

export { router };
