import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Proof Vault (Phase 1) listening on :${env.port} [${env.nodeEnv}]`);
});
