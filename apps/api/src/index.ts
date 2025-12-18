import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadSeed } from "./lib/loadSeed.js";
import { promptsRoutes } from "./routes/prompts.js";
import seedData from "../../../data/prompts.seed.json" with { type: "json" };

const app = Fastify();

let isInitialized = false;

async function setup() {
  if (isInitialized) return;
  
  await app.register(cors, {
    origin: true
  });

  const prompts = await loadSeed();
  await app.register(promptsRoutes, { prompts });
  
  await app.ready();
  isInitialized = true;
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    await setup();
    
    const url = new URL(request.url);
    const query = url.search;
    
    // Convert Request to Fastify injection
    const response = await app.inject({
      method: request.method as any,
      url: url.pathname + query,
      headers: Object.fromEntries(request.headers),
      payload: request.body ? await request.text() : undefined
    });

    // Convert Fastify response back to Worker Response
    // We filter out some headers that might cause issues in Workers
    const headers = new Headers();
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, String(value));
        }
      }
    }

    return new Response(response.payload, {
      status: response.statusCode,
      headers
    });
  }
};
