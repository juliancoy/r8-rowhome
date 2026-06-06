import { createServer } from "vite";

export async function withTsModule(modulePath, callback) {
  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { hmr: false, middlewareMode: true }
  });

  try {
    const module = await server.ssrLoadModule(modulePath);
    return await callback(module);
  } finally {
    await server.close();
  }
}
