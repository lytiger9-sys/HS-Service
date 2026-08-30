import { commandList } from "./commands/index.js";

function buildCommandPayload() {
  const commandPayload = commandList.map((command) => command.data.toJSON());
  const commandNames = commandPayload.map((command) => command.name);
  const duplicateNames = commandNames.filter((name, index) => commandNames.indexOf(name) !== index);

  if (duplicateNames.length) {
    throw new Error(`[commands] duplicate command names: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  return commandPayload;
}

export async function syncGlobalCommands(client, reason = "startup") {
  if (!client.application) {
    throw new Error("[commands] Discord application 정보를 찾을 수 없습니다.");
  }

  const commandPayload = buildCommandPayload();
  console.log(`[commands] preparing ${commandPayload.length} global slash commands (${reason}): ${commandPayload.map((command) => command.name).join(", ")}`);
  const registered = await client.application.commands.set(commandPayload);
  console.log(`[commands] synced ${registered.size} global slash commands (${reason})`);
  return registered;
}
