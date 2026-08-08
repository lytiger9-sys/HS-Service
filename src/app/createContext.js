import { StateStore } from "../storage/stateStore.js";
import { createServices } from "../services/index.js";

export async function createContext(config) {
  const store = new StateStore({
    mongoUri: config.mongoUri,
    mongoDbName: config.mongoDbName
  });
  await store.load();

  const context = {
    config,
    store,
    client: null
  };

  context.services = createServices(context);
  return context;
}
