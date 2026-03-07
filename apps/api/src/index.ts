import { createApp } from "./app.js";

const app = await createApp();

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`API running at http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
