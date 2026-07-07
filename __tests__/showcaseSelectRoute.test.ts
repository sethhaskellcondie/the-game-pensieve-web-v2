/**
 * @jest-environment node
 */
// POST /api/showcase/select: slug validation against the directory, cookie
// set/clear, and the impersonation hand-off (selecting a showcase ends any
// active act-as).

import { POST } from "@/app/api/showcase/select/route";
import { listShowcases } from "@/lib/api";
import { fetchMe } from "@/lib/authBackend";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  listShowcases: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/authBackend", () => ({
  fetchMe: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const mockListShowcases = listShowcases as jest.MockedFunction<
  typeof listShowcases
>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockFetchMe = fetchMe as jest.MockedFunction<typeof fetchMe>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

type FakeSession = {
  accessToken?: string;
  role?: string;
  email?: string;
  impersonatingUserId?: number;
  impersonatedEmail?: string;
  save: jest.Mock;
};

function primeSession(overrides: Partial<FakeSession> = {}): FakeSession {
  const session: FakeSession = { save: jest.fn(), ...overrides };
  mockGetSession.mockResolvedValue(
    session as unknown as Awaited<ReturnType<typeof getSession>>,
  );
  return session;
}

function primeCookies() {
  const store = { set: jest.fn(), delete: jest.fn(), get: jest.fn() };
  mockCookies.mockResolvedValue(
    store as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  return store;
}

function selectRequest(body: unknown): Request {
  return new Request("http://test.local/api/showcase/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DIRECTORY = [
  { slug: "showcase-one", name: "Showcase One" },
  { slug: "showcase-two", name: "Showcase Two" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockListShowcases.mockResolvedValue(DIRECTORY);
});

describe("POST /api/showcase/select", () => {
  it("rejects a non-string slug", async () => {
    primeCookies();
    primeSession();
    const res = await POST(selectRequest({ slug: 42 }));
    expect(res.status).toBe(400);
  });

  it("rejects a slug that is not in the directory and sets no cookie", async () => {
    const store = primeCookies();
    primeSession();
    const res = await POST(selectRequest({ slug: "no-such-slug" }));
    expect(res.status).toBe(404);
    expect(store.set).not.toHaveBeenCalled();
  });

  it("sets the cookie and returns the active showcase for a visible slug", async () => {
    const store = primeCookies();
    primeSession({ accessToken: "t", role: "paid", email: "c@x.z" });
    const res = await POST(selectRequest({ slug: "showcase-one" }));
    expect(res.status).toBe(200);
    expect(store.set).toHaveBeenCalledWith(
      "gp_showcase",
      "showcase-one",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    const body = (await res.json()) as {
      data: { activeShowcase: { slug: string; name: string } };
    };
    expect(body.data.activeShowcase).toEqual({
      slug: "showcase-one",
      name: "Showcase One",
    });
  });

  it("clears the cookie (and reports no showcase) for a null slug", async () => {
    const store = primeCookies();
    primeSession({ accessToken: "t", role: "paid" });
    const res = await POST(selectRequest({ slug: null }));
    expect(res.status).toBe(200);
    expect(store.delete).toHaveBeenCalledWith("gp_showcase");
    expect(store.set).not.toHaveBeenCalled();
    const body = (await res.json()) as {
      data: { activeShowcase: unknown };
    };
    expect(body.data.activeShowcase).toBeNull();
  });

  it("stops an active impersonation when a showcase is selected", async () => {
    primeCookies();
    const session = primeSession({
      accessToken: "t",
      role: "paid", // the TARGET's role while impersonating
      email: "admin@x.z",
      impersonatingUserId: 42,
      impersonatedEmail: "user@x.z",
    });
    mockFetchMe.mockResolvedValue({ role: "admin", impersonatedEmail: null, accessUntil: null });

    const res = await POST(selectRequest({ slug: "showcase-two" }));
    expect(res.status).toBe(200);
    expect(session.impersonatingUserId).toBeUndefined();
    expect(session.impersonatedEmail).toBeUndefined();
    // The admin's own role is restored from /me and persisted.
    expect(session.role).toBe("admin");
    expect(session.save).toHaveBeenCalled();
    const body = (await res.json()) as {
      data: { isImpersonating: boolean; role: string };
    };
    expect(body.data.isImpersonating).toBe(false);
    expect(body.data.role).toBe("admin");
  });
});
