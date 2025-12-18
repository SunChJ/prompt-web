import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadSeed } from "./lib/loadSeed.js";
import { promptsRoutes } from "./routes/prompts.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true
  });

  const prompts = await loadSeed();
  await app.register(promptsRoutes, { prompts });

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


