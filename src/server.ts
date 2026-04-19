import { initSchema } from "./db/connection.ts";
import { handleError, notFound } from "./lib/errors.ts";
import * as owners from "./routes/owners.ts";

// Initialise schema on startup if the DB is empty
// (In development we rely on `bun run db:reset` to fully seed.)
import { existsSync } from "fs";
if (!existsSync(process.env.DB_PATH ?? "daycare.db")) {
    console.log("Database not found, initialising schema...");
    initSchema();
}

const PORT = Number(process.env.PORT ?? 3000);

interface Route {
    method: string;
    pattern: RegExp;
    handler: (req: Request, params: RegExpMatchArray) => Response | Promise<Response>;
}

// NOTE: Only owner routes are registered in this commit.
// Dogs, staff, and bookings routes will be added by the next two commits.
const routes: Route[] = [
    { method: "GET", pattern: /^\/owners\/?$/, handler: (req) => owners.listOwners(req) },
    { method: "POST", pattern: /^\/owners\/?$/, handler: (req) => owners.createOwner(req) },
    { method: "GET", pattern: /^\/owners\/(\d+)\/dogs\/?$/, handler: (req, p) => owners.getOwnerDogs(Number(p[1]), req) },
    { method: "GET", pattern: /^\/owners\/(\d+)\/?$/, handler: (_req, p) => owners.getOwner(Number(p[1])) },
    { method: "PATCH", pattern: /^\/owners\/(\d+)\/?$/, handler: (req, p) => owners.updateOwner(Number(p[1]), req) },
    { method: "DELETE", pattern: /^\/owners\/(\d+)\/?$/, handler: (_req, p) => owners.deleteOwner(Number(p[1])) },
];

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        // Health check
        if (path === "/" || path === "/health") {
            return Response.json({
                status: "ok",
                service: "dog-daycare-api",
                version: "1.0.0",
                resources: ["owners"],
            });
        }

        try {
            for (const route of routes) {
                const match = path.match(route.pattern);
                if (match && route.method === req.method) {
                    return await route.handler(req, match);
                }
            }

            // Method matched the path but not the verb -> 405
            const anyMethodMatch = routes.find((r) => path.match(r.pattern));
            if (anyMethodMatch) {
                return Response.json(
                    { error: { code: "METHOD_NOT_ALLOWED", message: `${req.method} not supported for ${path}` } },
                    { status: 405 },
                );
            }

            throw notFound("Route", path);
        } catch (err) {
            return handleError(err);
        }
    },
});

console.log(`Dog Daycare API running at http://localhost:${server.port}`);
console.log("Try: curl http://localhost:" + server.port + "/owners");
