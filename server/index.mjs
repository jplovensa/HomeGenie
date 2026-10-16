import { createAppServer } from "./app.mjs";
const port = Number(process.env.PORT || 3000);
const server = createAppServer();
server.on("error", (error) => {
  console.error("HomeGenie server could not start:", error.code);
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () =>
  console.log(
    `HomeGenie storefront and commerce API listening on port ${port}`,
  ),
);
