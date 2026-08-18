import { readFile } from "node:fs/promises";
import ejs from "ejs";

for (const file of ["website/views/license-login.ejs", "website/views/license-dashboard.ejs", "website/views/activation.ejs", "website/views/plan-dashboard.ejs", "website/views/dashboard.ejs"]) {
  const source = await readFile(file, "utf8");
  ejs.compile(source, { filename: file });
  if (file === "website/views/license-dashboard.ejs") {
    if (source.includes('name="feature_<%= feature.id %>" value="off"')) {
      throw new Error("license-dashboard must not duplicate feature checkbox values with hidden off inputs");
    }
    if (source.includes('name="otherCommandsEnabled" value="off"')) {
      throw new Error("license-dashboard must not duplicate otherCommandsEnabled with a hidden off input");
    }
  }
}
console.log("EJS templates: OK");
