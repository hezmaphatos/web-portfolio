import { test as teardown } from "@playwright/test";

import { adminApi, expect, sweepTestProjects } from "./support";

/** After the run: no test project is left behind and the run's admin token is revoked. */
teardown("clean up test projects and log out", async () => {
  const api = await adminApi();
  try {
    await sweepTestProjects(api);
    const response = await api.post("/api/admin/logout");
    expect(response.ok()).toBe(true);
  } finally {
    await api.dispose();
  }
});
