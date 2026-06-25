import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearToken, getRefreshToken, getToken, setTokens } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api request()", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("attaches the bearer token and returns parsed JSON on success", async () => {
    setTokens("access-1", "refresh-1");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, username: "admin" }));
    vi.stubGlobal("fetch", fetchMock);

    const user = await api.me();

    expect(user.username).toBe("admin");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-1");
  });

  it("silently refreshes and retries once on a 401, without surfacing an error", async () => {
    setTokens("expired-access", "valid-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid token" }, 401)) // first /auth/me call
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" })
      ) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: "admin" })); // retried /auth/me
    vi.stubGlobal("fetch", fetchMock);

    const user = await api.me();

    expect(user.username).toBe("admin");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
  });

  it("clears tokens and redirects to /login when refresh also fails", async () => {
    setTokens("expired-access", "expired-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid token" }, 401)) // /auth/me
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid refresh token" }, 401)); // /auth/refresh
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { href: "" });

    await expect(api.me()).rejects.toThrow("Unauthorized");

    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("does not attempt a refresh loop when the refresh endpoint itself 401s directly", async () => {
    setTokens("a", "b");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: "nope" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { href: "" });

    await expect(api.me()).rejects.toThrow("Unauthorized");
    // one /auth/me call + one /auth/refresh call, no further recursion
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("token storage helpers", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips access and refresh tokens", () => {
    setTokens("acc", "ref");
    expect(getToken()).toBe("acc");
    expect(getRefreshToken()).toBe("ref");
    clearToken();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe("api.me() request dedup", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shares one in-flight /auth/me request across concurrent callers", async () => {
    setTokens("acc", "ref");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, username: "admin" }));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([api.me(), api.me()]);

    expect(a.username).toBe("admin");
    expect(b.username).toBe("admin");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches after setTokens()/clearToken() reset the cache", async () => {
    setTokens("acc", "ref");
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ id: 1, username: "admin" }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.me();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setTokens("acc2", "ref2");
    await api.me();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clearToken();
    setTokens("acc3", "ref3");
    await api.me();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
