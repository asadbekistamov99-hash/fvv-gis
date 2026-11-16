import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  clearSession,
  displayDate,
  queryParams,
  setSession,
  validateGeometry,
} from "../api";
import { dictionary, statusKey } from "../i18n";
afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});
describe("GIS trust-boundary validation", () => {
  it("rejects invalid coordinates, unclosed rings, and short lines", () => {
    expect(validateGeometry({ type: "Point", coordinates: [181, 41] })).toBe(
      false,
    );
    expect(
      validateGeometry({ type: "Point", coordinates: [69, Infinity] }),
    ).toBe(false);
    expect(
      validateGeometry({
        type: "Polygon",
        coordinates: [
          [
            [69, 41],
            [70, 41],
            [70, 42],
            [69, 42],
          ],
        ],
      }),
    ).toBe(false);
    expect(
      validateGeometry({ type: "LineString", coordinates: [[69, 41]] }),
    ).toBe(false);
  });
  it("accepts supported WGS84 geometry", () => {
    expect(validateGeometry({ type: "Point", coordinates: [69.2, 41.3] })).toBe(
      true,
    );
    expect(
      validateGeometry({
        type: "Polygon",
        coordinates: [
          [
            [69, 41],
            [70, 41],
            [70, 42],
            [69, 41],
          ],
        ],
      }),
    ).toBe(true);
  });
});
describe("authenticated transport", () => {
  it("includes access credentials without persisting them", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "safe" }), { status: 200 }),
      );
    setSession({ access_token: "test-access", refresh_token: "test-refresh" });
    await api("/users/me");
    expect(
      new Headers(mock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer test-access");
    expect(localStorage.getItem("access_token")).toBeNull();
  });
  it("does not hide optimistic concurrency errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Version conflict" }), {
        status: 409,
      }),
    );
    await expect(api("/infrastructure/a")).rejects.toEqual(
      expect.objectContaining({ status: 409, message: "Version conflict" }),
    );
  });
  it("rotates a session once before retrying the request", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "next", refresh_token: "rotated" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "me" }), { status: 200 }),
      );
    setSession({ access_token: "expired", refresh_token: "refresh" });
    expect(await api("/users/me")).toEqual({ id: "me" });
    expect(mock).toHaveBeenCalledTimes(3);
    expect(
      new Headers(mock.mock.calls[2][1]?.headers).get("Authorization"),
    ).toBe("Bearer next");
  });
  it("reports network failure rather than returning invented data", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(api("/infrastructure")).rejects.toBeInstanceOf(ApiError);
  });
});
it("keeps localization and public state labels consistent", () => {
  expect(Object.keys(dictionary.ru).sort()).toEqual(
    Object.keys(dictionary.uz).sort(),
  );
  expect(Object.keys(dictionary.en).sort()).toEqual(
    Object.keys(dictionary.uz).sort(),
  );
  expect(statusKey.faulty).toBe("faulty");
  expect(dictionary.uz.faulty).toBe("Nosoz");
});
it("preserves missing values and encodes filters", () => {
  expect(displayDate(null)).toBe("—");
  expect(queryParams({ search: "Gidrant & suv", region_id: "" })).toBe(
    "?search=Gidrant+%26+suv",
  );
});
