import request from "supertest";

// Mock Supabase and Anthropic before importing app
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock("@anthropic-ai/sdk", () => ({
  default: jest.fn().mockImplementation(() => ({})),
}));

import { app } from "../app";

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.app).toBe("LaunchPad API");
  });
});
