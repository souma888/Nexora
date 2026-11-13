import { defineConfig, devices } from '@playwright/test';

const deployed = process.env.NEXORA_TEST_URL;
const baseURL = deployed || 'http://127.0.0.1:3099';
const channel = process.env.NEXORA_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  workers: 1,
  use: { baseURL, channel },
  webServer: deployed
    ? undefined
    : {
        command: 'node backend/dev-server.js',
        env: { PORT: '3099' },
        url: baseURL,
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
