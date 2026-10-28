import { describe, expect, it } from "vitest";

import { frameVerdict, type FrameHeaders } from "./framing";

const site = new URL("https://yourdomain.dev/projects/mindlens");
const target = new URL("https://example.com/");

const verdict = (headers: Partial<FrameHeaders>, ancestor = site, framed = target) =>
  frameVerdict({ xFrameOptions: null, contentSecurityPolicy: null, ...headers }, framed, ancestor);

describe("frameVerdict", () => {
  it("allows a page without framing headers", () => {
    expect(verdict({})).toBe("allowed");
  });

  it("follows X-Frame-Options", () => {
    expect(verdict({ xFrameOptions: "DENY" })).toBe("blocked");
    expect(verdict({ xFrameOptions: "sameorigin" })).toBe("blocked");
    expect(verdict({ xFrameOptions: "SAMEORIGIN" }, target)).toBe("allowed");
    expect(verdict({ xFrameOptions: "SAMEORIGIN, DENY" }, target)).toBe("blocked");
    // Obsolete: ignored by current browsers.
    expect(verdict({ xFrameOptions: "ALLOW-FROM https://yourdomain.dev" })).toBe("allowed");
  });

  it("lets frame-ancestors override X-Frame-Options", () => {
    expect(
      verdict({
        xFrameOptions: "DENY",
        contentSecurityPolicy: "frame-ancestors https://yourdomain.dev",
      }),
    ).toBe("allowed");
    expect(verdict({ contentSecurityPolicy: "default-src 'self'; frame-ancestors 'none'" })).toBe(
      "blocked",
    );
  });

  it("matches frame-ancestors sources", () => {
    const csp = (value: string) => verdict({ contentSecurityPolicy: `frame-ancestors ${value}` });
    expect(csp("*")).toBe("allowed");
    expect(csp("'self'")).toBe("blocked");
    expect(csp("https:")).toBe("allowed");
    expect(csp("http:")).toBe("allowed"); // http: also allows https:
    expect(csp("*.yourdomain.dev")).toBe("blocked"); // a wildcard needs a subdomain
    expect(csp("*.dev")).toBe("allowed");
    expect(csp("yourdomain.dev")).toBe("allowed");
    expect(csp("https://yourdomain.dev:443")).toBe("allowed");
    expect(csp("https://yourdomain.dev:8443")).toBe("blocked");
    expect(csp("https://other.dev https://yourdomain.dev/path")).toBe("allowed");
    expect(csp("https://github.com")).toBe("blocked");
  });

  it("checks the port of a local ancestor", () => {
    const local = new URL("http://localhost:3100/");
    const csp = (value: string) =>
      verdict({ contentSecurityPolicy: `frame-ancestors ${value}` }, local);
    expect(csp("localhost")).toBe("blocked"); // default port only
    expect(csp("localhost:3100")).toBe("allowed");
    expect(csp("http://localhost:*")).toBe("allowed");
    expect(csp("https://localhost:3100")).toBe("blocked");
  });

  it("needs every policy to allow the ancestor", () => {
    expect(verdict({ contentSecurityPolicy: "frame-ancestors *, frame-ancestors 'self'" })).toBe(
      "blocked",
    );
    expect(verdict({ contentSecurityPolicy: "script-src 'self', frame-ancestors *" })).toBe(
      "allowed",
    );
  });
});
