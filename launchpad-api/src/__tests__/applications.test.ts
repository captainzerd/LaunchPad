import request from "supertest";

const mockSingle: jest.Mock = jest.fn();
const mockSelect: jest.Mock = jest.fn();
const mockEq: jest.Mock = jest.fn();
const mockInsert: jest.Mock = jest.fn();
const mockUpdate: jest.Mock = jest.fn();
const mockDelete: jest.Mock = jest.fn();
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
  mockEq.mockReturnValue({ data: null, error: null, single: mockSingle, select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockDelete.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });
});

describe("GET /applications/:userId", () => {
  it("returns applications for a user", async () => {
    const apps = [{ id: "1", user_id: "user1", stage: "applied" }];
    mockEq.mockReturnValue({ data: apps, error: null });

    const res = await request(app).get("/applications/user1");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(apps);
  });

  it("returns 500 on supabase error", async () => {
    mockEq.mockReturnValue({ data: null, error: { message: "DB error" } });

    const res = await request(app).get("/applications/user1");
    expect(res.status).toBe(500);
  });
});

describe("POST /applications", () => {
  it("creates an application with defaults", async () => {
    const created = { id: "new1", user_id: "u1", scheme_id: "s1", stage: "discovered" };
    mockSingle.mockReturnValue({ data: created, error: null });

    const res = await request(app)
      .post("/applications")
      .send({ user_id: "u1", scheme_id: "s1" });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(created);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await request(app)
      .post("/applications")
      .send({ scheme_id: "s1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/user_id/);
  });

  it("returns 400 when scheme_id is missing", async () => {
    const res = await request(app)
      .post("/applications")
      .send({ user_id: "u1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheme_id/);
  });

  it("returns 400 for invalid stage", async () => {
    const res = await request(app)
      .post("/applications")
      .send({ user_id: "u1", scheme_id: "s1", stage: "invalid_stage" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stage/);
  });
});

describe("PATCH /applications/:id", () => {
  it("updates stage", async () => {
    const updated = { id: "1", stage: "applied" };
    mockEq.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockReturnValue({ data: updated, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const res = await request(app)
      .patch("/applications/1")
      .send({ stage: "applied" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(updated);
  });

  it("returns 400 when no valid fields provided", async () => {
    const res = await request(app)
      .patch("/applications/1")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid fields/);
  });

  it("returns 400 for invalid stage", async () => {
    const res = await request(app)
      .patch("/applications/1")
      .send({ stage: "bad_stage" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stage/);
  });
});

describe("DELETE /applications/:id", () => {
  it("deletes an application", async () => {
    mockEq.mockReturnValue({ error: null });

    const res = await request(app).delete("/applications/1");
    expect(res.status).toBe(204);
  });

  it("returns 500 on supabase error", async () => {
    mockEq.mockReturnValue({ error: { message: "Delete failed" } });

    const res = await request(app).delete("/applications/1");
    expect(res.status).toBe(500);
  });
});
