"use client";

import { ErrorState } from "./ErrorState";

/** Shown by SessionGate when Laravel can't be reached to verify the session. */
export function SessionUnavailable() {
  return (
    <ErrorState
      title="Can't reach the API"
      message="The admin session couldn't be verified because the backend is not responding. Check that the API is running, then retry."
      onRetry={() => window.location.reload()}
    />
  );
}
