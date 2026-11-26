import { defineConfig, devices } from "@playwright/test";

// End-to-end: the real FastAPI backend (demo mode, in-memory SQLite, no YouTube calls)
// behind a production build of the frontend.
const API_PORT = 8001;
const WEB_PORT = 3100;
const PYTHON = process.env.PYTHON ?? ".venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    // Locally use the installed Google Chrome; CI installs Playwright's Chromium.
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke/ },
  ],
  webServer: [
    {
      command: `${PYTHON} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        DEMO_MODE: "true",
        DATABASE_URL: "sqlite:///:memory:",
        JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { BACKEND_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
