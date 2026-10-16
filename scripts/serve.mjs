import path from "node:path";
import { createAppServer } from "../server/app.mjs";
const args = process.argv.slice(2);
const index = args.indexOf("--port");
const port = Number(index >= 0 ? args[index + 1] : process.env.PORT || 5173);
const root = path.resolve(args.includes("--production") ? "_site" : ".");
const server = createAppServer({ root });
server.on("error", (error) => {
  console.error(`HomeGenie could not start on port ${port}: ${error.code}`);
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () =>
  console.log(`HomeGenie available on port ${port} (root and /HomeGenie/)`),
);
