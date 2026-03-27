import dotenv from "dotenv";
dotenv.config();

import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";

const router = Router();

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

router.post("/", async (req, res) => {
  console.log("Coach route hit:", {
    coachingType: req.body.coachingType,
    messageLength: req.body.message?.length,
  });

  try {
    const { message, coachingType, history, userProfile } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const basePrompt = SYSTEM_PROMPTS[coachingType] || SYSTEM_PROMPTS["CV Review"];

    let userContext = "";
    if (userProfile) {
      const { full_name, university, degree, graduation_year, target_sectors } = userProfile;
      const name = full_name || "The user";
      const sectors =
        Array.isArray(target_sectors) && target_sectors.length > 0
          ? target_sectors.join(", ")
          : "various sectors";
      userContext = `\n\nUser context: ${name} is a ${graduation_year ?? ""} student at ${university ?? "university"} studying ${degree ?? "an unknown subject"}, targeting ${sectors}.`.replace(/  +/g, " ");
    }

    const systemPrompt = basePrompt + userContext;

    const messages = [
      ...(history || []).map((h: any) => ({
        role: h.role as "user" | "assistant",
        content: String(h.content),
      })),
      { role: "user" as const, content: String(message) },
    ];

    console.log("Calling Anthropic API with", messages.length, "messages");

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    console.log("Anthropic API response received");

    const responseText =
      completion.content[0].type === "text"
        ? completion.content[0].text
        : "Sorry, I could not generate a response";

    res.json({ response: responseText });
  } catch (error: any) {
    console.error("Coach route error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export { router };
