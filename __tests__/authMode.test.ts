import { getAuthMode, resetAuthModeForTests } from "@/lib/authMode";
import { checkHeartbeat, type HeartbeatResult } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  checkHeartbeat: jest.fn(),
}));

const mockCheckHeartbeat = checkHeartbeat as jest.MockedFunction<
  typeof checkHeartbeat
>;

describe("getAuthMode", () => {
  beforeEach(() => {
    resetAuthModeForTests();
    mockCheckHeartbeat.mockReset();
  });

  it("resolves unsecured when the heartbeat reports secureMode false", async () => {
    mockCheckHeartbeat.mockResolvedValue({ ok: true, secureMode: false, version: null });
    expect(await getAuthMode()).toBe("unsecured");
  });

  it("resolves secured when the heartbeat reports secureMode true", async () => {
    mockCheckHeartbeat.mockResolvedValue({ ok: true, secureMode: true, version: null });
    expect(await getAuthMode()).toBe("secured");
  });

  it("caches a definitive answer for the life of the process", async () => {
    mockCheckHeartbeat.mockResolvedValue({ ok: true, secureMode: false, version: null });
    expect(await getAuthMode()).toBe("unsecured");
    expect(await getAuthMode()).toBe("unsecured");
    expect(mockCheckHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("fails closed to secured on an unknown flag, without caching it", async () => {
    // Backend unreachable / older backend: restrictive answer now...
    mockCheckHeartbeat.mockResolvedValueOnce({ ok: false, secureMode: null, version: null });
    expect(await getAuthMode()).toBe("secured");
    // ...but the next call re-probes and picks up the real mode.
    mockCheckHeartbeat.mockResolvedValueOnce({ ok: true, secureMode: false, version: null });
    expect(await getAuthMode()).toBe("unsecured");
    expect(mockCheckHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("fails closed to secured when the probe throws", async () => {
    mockCheckHeartbeat.mockRejectedValueOnce(new Error("network down"));
    expect(await getAuthMode()).toBe("secured");
  });

  it("shares one probe across concurrent callers", async () => {
    let release!: (value: HeartbeatResult) => void;
    mockCheckHeartbeat.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const first = getAuthMode();
    const second = getAuthMode();
    release({ ok: true, secureMode: true, version: null });
    expect(await first).toBe("secured");
    expect(await second).toBe("secured");
    expect(mockCheckHeartbeat).toHaveBeenCalledTimes(1);
  });
});
