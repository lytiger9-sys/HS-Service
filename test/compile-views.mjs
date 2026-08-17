import { readFile } from "node:fs/promises";
import ejs from "ejs";

for (const file of ["website/views/license-login.ejs", "website/views/license-dashboard.ejs"]) {
  const source = await readFile(file, "utf8");
  ejs.compile(source, { filename: file });
}
console.log("EJS templates: OK");
