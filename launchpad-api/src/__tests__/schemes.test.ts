import request from "supertest";

const mockSingle: jest.Mock = jest.fn();
const mockOrder: jest.Mock = jest.fn();
const mockEq: jest.Mock = jest.fn();
const mockSelect: jest.Mock = jest.fn();
const mockFrom: jest.Mock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(),
}));

process.env.SUPABASE_URL = "https://fake.supabase.co";
process.env.SUPABASE_ANON_KEY = "fake-key";

import { app } from "../app";

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockReturnValue({ data: null, error: null });
  mockOrder.mockReturnValue({ data: null, error: null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("GET /schemes", () => {
  it("returns schemes list", async () => {
    const schemes = [{ id: "1", scheme_name: "Test Scheme" }];
    mockOrder.mockReturnValue({ data: schemes, error: null });

    const res = await request(app).get("/schemes");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(schemes);
  });

  it("returns 500 on supabase error", async () => {
    mockOrder.mockReturnValue({ data: null, error: { message: "DB error" } });

    const res = await request(app).get("/schemes");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("DB error");
  });
});

describe("GET /schemes/:id", () => {
  it("returns a scheme by id", async () => {
    const scheme = { id: "abc", scheme_name: "My Scheme" };
    mockSingle.mockReturnValue({ data: scheme, error: null });

    const res = await request(app).get("/schemes/abc");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(scheme);
  });

  it("returns 404 when scheme not found", async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: "Not found" } });

    const res = await request(app).get("/schemes/missing");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Scheme not found");
  });
});
