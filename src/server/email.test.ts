import { describe, it, expect, vi, beforeEach } from "vitest";
import { Resend } from "resend";

import type { Env } from "./env";
import { sendEmail } from "./email";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

const ResendCtor = vi.mocked(Resend);

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    EMAIL_FROM: "no-reply@example.com",
    ENVIRONMENT: "test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost",
    PUBLIC_APP_URL: "http://localhost",
    ...overrides,
  };
}

describe("sendEmail", () => {
  beforeEach(() => {
    ResendCtor.mockClear();
    sendMock.mockReset();
  });

  it("sends the email through Resend when RESEND_API_KEY is set", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "msg_123" }, error: null });
    const env = baseEnv({ RESEND_API_KEY: "re_test_key" });

    await sendEmail(
      {
        to: "user@example.com",
        subject: "Subject",
        html: "<p>hi</p>",
        text: "hi",
      },
      env,
    );

    expect(ResendCtor).toHaveBeenCalledWith("re_test_key");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: "no-reply@example.com",
      to: "user@example.com",
      subject: "Subject",
      html: "<p>hi</p>",
      text: "hi",
    });
  });

  it("logs and does not call Resend when RESEND_API_KEY is missing (dev mode)", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const env = baseEnv({ RESEND_API_KEY: "" });

    await sendEmail(
      {
        to: "user@example.com",
        subject: "Subject",
        html: "<p>hi</p>",
        text: "hi",
      },
      env,
    );

    expect(ResendCtor).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain("RESEND_API_KEY not set");
    infoSpy.mockRestore();
  });

  it("logs structured error and rethrows when Resend returns an error", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "invalid_api_key",
        message: "API key is not valid",
        statusCode: 401,
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = baseEnv({ RESEND_API_KEY: "re_bad_key" });

    await expect(
      sendEmail(
        {
          to: "user@example.com",
          subject: "Subject",
          html: "<p>hi</p>",
          text: "hi",
        },
        env,
      ),
    ).rejects.toThrow(/Resend send failed: invalid_api_key/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorPayload = errorSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(errorPayload).toMatchObject({
      to: "user@example.com",
      from: "no-reply@example.com",
      errorName: "invalid_api_key",
      errorMessage: "API key is not valid",
      statusCode: 401,
    });
    errorSpy.mockRestore();
  });
});
