import { loadConfig } from "./config/env.js";
import { createContext } from "./app/createContext.js";
import { createBot } from "./bot/client.js";
import { startWebsite } from "../website/server.js";

async function main() {
  const config = loadConfig();
  const context = await createContext(config);
  const client = await createBot(context);
  context.client = client;
  await startWebsite(context);
}

main().catch((error) => {
  console.error("[boot] fatal error:", error);
  process.exitCode = 1;
});
