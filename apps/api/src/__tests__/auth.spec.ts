import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response as ExpressResponse, NextFunction } from "express";
import {
  validateTwitchToken,
  checkChannelRole,
  authenticate,
  requireBroadcaster,
  requireModerator,
  invalidateTokenCache,
  invalidateRoleCache,
  clearAllCaches,
  getCacheStats,
  type AuthenticatedRequest,
} from "../auth";

// Mock fetch globally
global.fetch = vi.fn();

describe("auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCaches();
  });

  describe("validateTwitchToken", () => {
    it("validates a valid token and caches it", async () => {
      const mockResponse = {
        user_id: "12345",
        login: "testuser",
        client_id: "test_client_id",
        expires_in: 3600,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await validateTwitchToken("valid_token");

      expect(result).toEqual({
        user_id: "12345",
        login: "testuser",
      });

      expect(fetch).toHaveBeenCalledWith(
        "https://id.twitch.tv/oauth2/validate",
        {
          headers: { Authorization: "OAuth valid_token" },
        },
      );

      // Verify caching - second call should not hit API
      const cachedResult = await validateTwitchToken("valid_token");
      expect(cachedResult).toEqual(result);
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("returns null for invalid token", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as unknown as Response);

      const result = await validateTwitchToken("invalid_token");

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await validateTwitchToken("error_token");

      expect(result).toBeNull();
    });

    it("returns null on invalid response schema", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "data" }),
      } as unknown as Response);

      const result = await validateTwitchToken("bad_schema_token");

      expect(result).toBeNull();
    });

    it("respects Twitch expires_in but caps at 5 minutes", async () => {
      const mockResponse = {
        user_id: "12345",
        login: "testuser",
        client_id: "test_client_id",
        expires_in: 7200, // 2 hours, should be capped at 5 minutes
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      await validateTwitchToken("long_expiry_token");

      // Token should be cached
      const stats = getCacheStats();
      expect(stats.tokenCacheSize).toBe(1);
    });
  });

  describe("checkChannelRole", () => {
    it("identifies broadcaster correctly", async () => {
      // Mock broadcaster lookup
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "12345", login: "broadcaster" }],
        }),
      } as unknown as Response);

      const result = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );

      expect(result).toEqual({
        isBroadcaster: true,
        isModerator: false,
      });

      expect(fetch).toHaveBeenCalledWith(
        "https://api.twitch.tv/helix/users?login=broadcaster",
        expect.objectContaining({
          headers: {
            "Client-Id": "client_id",
            Authorization: "Bearer user_token",
          },
        }),
      );
    });

    it("identifies moderator correctly", async () => {
      // Mock broadcaster lookup
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "99999", login: "broadcaster" }],
        }),
      } as unknown as Response);

      // Mock moderator check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ user_id: "12345", user_login: "moduser" }],
        }),
      } as unknown as Response);

      const result = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );

      expect(result).toEqual({
        isBroadcaster: false,
        isModerator: true,
      });
    });

    it("returns false for regular viewers", async () => {
      // Mock broadcaster lookup
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "99999", login: "broadcaster" }],
        }),
      } as unknown as Response);

      // Mock moderator check (empty)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      } as unknown as Response);

      const result = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );

      expect(result).toEqual({
        isBroadcaster: false,
        isModerator: false,
      });
    });

    it("caches role checks", async () => {
      // Mock broadcaster lookup
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "99999", login: "broadcaster" }],
        }),
      } as unknown as Response);

      // Mock moderator check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as unknown as Response);

      const result1 = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );
      const result2 = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );

      expect(result1).toEqual(result2);
      expect(fetch).toHaveBeenCalledTimes(2); // Only called once (cached on second call)
    });

    it("returns false on API error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as unknown as Response);

      const result = await checkChannelRole(
        "client_id",
        "12345",
        "broadcaster",
        "user_token",
      );

      expect(result).toEqual({
        isBroadcaster: false,
        isModerator: false,
      });
    });
  });

  describe("authenticate middleware", () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<ExpressResponse>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        cookies: {},
      };
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      next = vi.fn();

      process.env.TWITCH_CLIENT_ID = "test_client_id";
      process.env.TWITCH_CHANNEL_NAME = "test_channel";
    });

    it("rejects requests without token", () => {
      authenticate(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required. Please log in.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("authenticates valid token and attaches user", async () => {
      req.cookies = { auth_token: "valid_token" };

      // Mock token validation
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: "12345",
          login: "testuser",
          client_id: "test_client_id",
          expires_in: 3600,
        }),
      } as unknown as Response);

      // Mock broadcaster lookup
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "99999", login: "test_channel" }],
        }),
      } as unknown as Response);

      // Mock moderator check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as unknown as Response);

      authenticate(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(req.user).toEqual({
        userId: "12345",
        username: "testuser",
        isBroadcaster: false,
        isModerator: false,
      });
      expect(next).toHaveBeenCalled();
    });

    it("rejects invalid token", async () => {
      req.cookies = { auth_token: "invalid_token" };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as unknown as Response);

      authenticate(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid or expired token. Please log in again.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 500 on missing env vars", () => {
      delete process.env.TWITCH_CLIENT_ID;
      req.cookies = { auth_token: "valid_token" };

      authenticate(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Server misconfiguration",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireBroadcaster middleware", () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<ExpressResponse>;
    let next: NextFunction;

    beforeEach(() => {
      req = {};
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      next = vi.fn();
    });

    it("allows broadcasters", () => {
      req.user = {
        userId: "12345",
        username: "broadcaster",
        displayName: "Broadcaster",
        profileImageUrl: "https://example.com/avatar.jpg",
        isBroadcaster: true,
        isModerator: false,
      };

      requireBroadcaster(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects non-broadcasters", () => {
      req.user = {
        userId: "12345",
        username: "viewer",
        displayName: "Viewer",
        profileImageUrl: "https://example.com/avatar.jpg",
        isBroadcaster: false,
        isModerator: false,
      };

      requireBroadcaster(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "This action requires broadcaster permissions",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated requests", () => {
      requireBroadcaster(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireModerator middleware", () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<ExpressResponse>;
    let next: NextFunction;

    beforeEach(() => {
      req = {};
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      next = vi.fn();
    });

    it("allows moderators", () => {
      req.user = {
        userId: "12345",
        username: "mod",
        displayName: "Mod",
        profileImageUrl: "https://example.com/avatar.jpg",
        isBroadcaster: false,
        isModerator: true,
      };

      requireModerator(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("allows broadcasters", () => {
      req.user = {
        userId: "12345",
        username: "broadcaster",
        displayName: "Broadcaster",
        profileImageUrl: "https://example.com/avatar.jpg",
        isBroadcaster: true,
        isModerator: false,
      };

      requireModerator(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects regular viewers", () => {
      req.user = {
        userId: "12345",
        username: "viewer",
        displayName: "Viewer",
        profileImageUrl: "https://example.com/avatar.jpg",
        isBroadcaster: false,
        isModerator: false,
      };

      requireModerator(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "This action requires moderator or broadcaster permissions",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated requests", () => {
      requireModerator(
        req as AuthenticatedRequest,
        res as unknown as ExpressResponse,
        next,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("cache management", () => {
    it("invalidates token cache", async () => {
      // Add token to cache
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: "12345",
          login: "testuser",
          client_id: "test_client_id",
          expires_in: 3600,
        }),
      } as unknown as Response);

      await validateTwitchToken("test_token");
      expect(getCacheStats().tokenCacheSize).toBe(1);

      // Invalidate
      invalidateTokenCache("test_token");
      expect(getCacheStats().tokenCacheSize).toBe(0);
    });

    it("invalidates role cache", async () => {
      // Add role to cache
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "99999", login: "broadcaster" }],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        } as unknown as Response);

      await checkChannelRole("client_id", "12345", "broadcaster", "token");
      expect(getCacheStats().roleCacheSize).toBe(1);

      // Invalidate
      invalidateRoleCache("12345", "broadcaster");
      expect(getCacheStats().roleCacheSize).toBe(0);
    });

    it("clears all caches", async () => {
      // Add token
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user_id: "12345",
          login: "testuser",
          client_id: "test_client_id",
          expires_in: 3600,
        }),
      } as unknown as Response);
      await validateTwitchToken("test_token");

      // Add role
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "99999", login: "broadcaster" }],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        } as unknown as Response);
      await checkChannelRole("client_id", "12345", "broadcaster", "token");

      const statsBefore = getCacheStats();
      expect(statsBefore.tokenCacheSize).toBe(1);
      expect(statsBefore.roleCacheSize).toBe(1);

      clearAllCaches();

      const statsAfter = getCacheStats();
      expect(statsAfter.tokenCacheSize).toBe(0);
      expect(statsAfter.roleCacheSize).toBe(0);
    });
  });
});
