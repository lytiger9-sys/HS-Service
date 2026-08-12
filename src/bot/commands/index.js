import notice from "./notice.js";
import serverinfo from "./serverinfo.js";
import joinorder from "./joinorder.js";
import save from "./save.js";
import savednotes from "./savednotes.js";
import clear from "./clear.js";
import punishments from "./punishments.js";
import tempvoice from "./tempvoice.js";
import staff from "./staff.js";

export const commandList = [
  notice,
  serverinfo,
  joinorder,
  save,
  savednotes,
  clear,
  punishments,
  tempvoice,
  staff
];

export const commandMap = new Map(commandList.map((command) => [command.data.name, command]));
