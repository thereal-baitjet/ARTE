import { defineConfig } from "@playwright/test";
import { createHash, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";

const proxyServer = process.env.PLAYWRIGHT_PROXY_SERVER;
const proxyCertificatePath = process.env.PLAYWRIGHT_PROXY_CERT_FILE;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const launchArgs = executablePath ? ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-gpu"] : [];

if (proxyServer && proxyCertificatePath) {
  // Trust only the explicitly supplied proxy CA key in this browser process.
  const certificate = new X509Certificate(readFileSync(proxyCertificatePath));
  const publicKey = certificate.publicKey.export({ type: "spki", format: "der" });
  const fingerprint = createHash("sha256").update(publicKey).digest("base64");
  launchArgs.push(`--ignore-certificate-errors-spki-list=${fingerprint}`);
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath,
      args: launchArgs,
      proxy: proxyServer ? { server: proxyServer, bypass: "127.0.0.1,localhost" } : undefined,
    },
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
