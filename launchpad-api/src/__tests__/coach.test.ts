import request from "supertest";

// Mock Supabase (not used by coach but imported via app)
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({})),
}));

// Mock Anthropic SDK — __esModule: true ensures esModuleInterop uses .default correctly
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(),
}));

process.env.ANTHROPIC_API_KEY = "fake-anthropic-key";

import { app } from "../app";
import Anthropic from "@anthropic-ai/sdk";

const MockAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

beforeEach(() => {
  jest.clearAllMocks();
});

function setupAnthropicMock(responseText: string) {
  const mockCreate = jest.fn().mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: responseText }],
  });
  MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }) as any);
  return mockCreate;
}

describe("POST /coach", () => {
  it("returns a coach response", async () => {
    setupAnthropicMock("Here is my feedback on your CV.");

    const res = await request(app)
      .post("/coach")
      .send({ message: "Please review my CV", coachingType: "CV Review" });

    expect(res.status).toBe(200);
    expect(res.body.data.response).toBe("Here is my feedback on your CV.");
  });

  it("returns 400 when message is missing", async () => {
    const res = await request(app).post("/coach").send({ coachingType: "CV Review" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/);
  });

  it("returns 400 when message exceeds 4000 chars", async () => {
    const res = await request(app)
      .post("/coach")
      .send({ message: "a".repeat(4001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/4000/);
  });

  it("defaults to CV Review coaching type for unknown type", async () => {
    setupAnthropicMock("CV feedback");

    const res = await request(app)
      .post("/coach")
      .send({ message: "Hello", coachingType: "Unknown Type" });

    expect(res.status).toBe(200);
    expect(res.body.data.response).toBe("CV feedback");
  });

  it("filters invalid history entries", async () => {
    const mockCreate = setupAnthropicMock("Response");

    const res = await request(app)
      .post("/coach")
      .send({
        message: "Hello",
        history: [
          { role: "user", content: "Valid" },
          { role: "invalid", content: "Bad role" },
          null,
          { role: "assistant", content: "Valid response" },
        ],
      });

    expect(res.status).toBe(200);
    const calledMessages = mockCreate.mock.calls[0][0].messages;
    // 2 valid history entries + 1 current message
    expect(calledMessages.length).toBe(3);
  });

  it("returns 500 on Anthropic error", async () => {
    MockAnthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error("Anthropic API failure")) },
    }) as any);

    const res = await request(app)
      .post("/coach")
      .send({ message: "Hello" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/AI service error/);
  });
});
