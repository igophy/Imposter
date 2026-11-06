import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  expect: { timeout: 6000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: process.env.IMPOSTOR_CHROMIUM_PATH
      ? {
          executablePath: process.env.IMPOSTOR_CHROMIUM_PATH,
          args: ["--no-sandbox", "--disable-gpu", "--no-zygote"]
        }
      : {}
  },
  projects: [
    {
      name: "mobile-light",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "light"
      }
    },
    {
      name: "small-dark",
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark"
      }
    }
  ],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
