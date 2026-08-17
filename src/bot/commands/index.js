import serverinfo from "./serverinfo.js";
import joinorder from "./joinorder.js";
import save from "./save.js";
import savednotes from "./savednotes.js";
import clear from "./clear.js";
import punishments from "./punishments.js";
import tempvoice from "./tempvoice.js";
import staff from "./staff.js";
import honeypotban from "./honeypotban.js";
import honeypotkick from "./honeypotkick.js";

export const commandList = [
  serverinfo,
  joinorder,
  save,
  savednotes,
  clear,
  punishments,
  tempvoice,
  staff,
  honeypotban,
  honeypotkick
];

export const commandMap = new Map(commandList.map((command) => [command.data.name, command]));
