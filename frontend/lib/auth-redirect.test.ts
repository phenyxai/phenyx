import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_ROUTE,
  WELCOME_ROUTE,
  oauthCallbackUrl,
  postAuthDestination,
  safeReturnTo,
} from "./auth-redirect.ts";

test("home is the constellation and new people start at welcome", () => {
  assert.equal(HOME_ROUTE, "/dashboard/constellation");
  assert.equal(WELCOME_ROUTE, "/welcome");
});

test("a new person always goes to welcome, even with a deep link", () => {
  assert.equal(postAuthDestination({ isNew: true }), "/welcome");
  assert.equal(postAuthDestination({ isNew: true, returnTo: "/dashboard/polaris" }), "/welcome");
});

test("a returning person lands on the constellation", () => {
  assert.equal(postAuthDestination({ isNew: false }), "/dashboard/constellation");
  assert.equal(postAuthDestination({ isNew: false, returnTo: null }), "/dashboard/constellation");
});

test("a returning person follows a safe deep link back", () => {
  assert.equal(
    postAuthDestination({ isNew: false, returnTo: "/dashboard/polaris?thread=1" }),
    "/dashboard/polaris?thread=1",
  );
});

test("safeReturnTo keeps same-origin paths only", () => {
  assert.equal(safeReturnTo("/upgrade"), "/upgrade");
  assert.equal(safeReturnTo(null), null);
  assert.equal(safeReturnTo(undefined), null);
  assert.equal(safeReturnTo(""), null);
  assert.equal(safeReturnTo("https://evil.example"), null);
  assert.equal(safeReturnTo("//evil.example/path"), null);
  assert.equal(safeReturnTo("/\\evil.example"), null);
  assert.equal(safeReturnTo("javascript:alert(1)"), null);
  assert.equal(safeReturnTo("dashboard"), null);
});

test("safeReturnTo never sends someone back into the sign-in screens", () => {
  assert.equal(safeReturnTo("/signin"), null);
  assert.equal(safeReturnTo("/join?x=1"), null);
  assert.equal(safeReturnTo("/auth/callback?code=abc"), null);
  assert.equal(safeReturnTo("/welcome"), null);
});

test("oauthCallbackUrl points Google back at the callback, carrying a safe returnTo", () => {
  assert.equal(oauthCallbackUrl("http://localhost:3497"), "http://localhost:3497/auth/callback");
  assert.equal(
    oauthCallbackUrl("https://staging.phenyxcollective.com", "/dashboard/polaris"),
    "https://staging.phenyxcollective.com/auth/callback?returnTo=%2Fdashboard%2Fpolaris",
  );
  assert.equal(
    oauthCallbackUrl("https://phenyxai.com", "https://evil.example"),
    "https://phenyxai.com/auth/callback",
  );
});
