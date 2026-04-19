import { initSchema } from "./db/connection.ts";
import { handleError, notFound } from "./lib/errors.ts";
import * as owners from "./routes/owners.ts";
import * as dogs from "./routes/dogs.ts";
import * as staff from "./routes/staff.ts";
import * as bookings from "./routes/bookings.ts";

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

const routes: Route[] = [
    // Owners
    { method: "GET", pattern: /^\/owners\/?$/, handler: (req) => owners.listOwners(req) },
    { method: "POST", pattern: /^\/owners\/?$/, handler: (req) => owners.createOwner(req) },
    { method: "GET", pattern: /^\/owners\/(\d+)\/dogs\/?$/, handler: (req, p) => owners.getOwnerDogs(Number(p[1]), req) },
    { method: "GET", pattern: /^\/owners\/(\d+)\/?$/, handler: (_req, p) => owners.getOwner(Number(p[1])) },
    { method: "PATCH", pattern: /^\/owners\/(\d+)\/?$/, handler: (req, p) => owners.updateOwner(Number(p[1]), req) },
    { method: "DELETE", pattern: /^\/owners\/(\d+)\/?$/, handler: (_req, p) => owners.deleteOwner(Number(p[1])) },

    // Dogs
    { method: "GET", pattern: /^\/dogs\/?$/, handler: (req) => dogs.listDogs(req) },
    { method: "POST", pattern: /^\/dogs\/?$/, handler: (req) => dogs.createDog(req) },
    { method: "GET", pattern: /^\/dogs\/(\d+)\/?$/, handler: (_req, p) => dogs.getDog(Number(p[1])) },
    { method: "PATCH", pattern: /^\/dogs\/(\d+)\/?$/, handler: (req, p) => dogs.updateDog(Number(p[1]), req) },
    { method: "DELETE", pattern: /^\/dogs\/(\d+)\/?$/, handler: (_req, p) => dogs.deleteDog(Number(p[1])) },

    // Staff
    { method: "GET", pattern: /^\/staff\/?$/, handler: (req) => staff.listStaff(req) },
    { method: "POST", pattern: /^\/staff\/?$/, handler: (req) => staff.createStaff(req) },
    { method: "GET", pattern: /^\/staff\/(\d+)\/?$/, handler: (_req, p) => staff.getStaff(Number(p[1])) },
    { method: "PATCH", pattern: /^\/staff\/(\d+)\/?$/, handler: (req, p) => staff.updateStaff(Number(p[1]), req) },
    { method: "DELETE", pattern: /^\/staff\/(\d+)\/?$/, handler: (_req, p) => staff.deleteStaff(Number(p[1])) },

    // Bookings
    { method: "GET", pattern: /^\/bookings\/?$/, handler: (req) => bookings.listBookings(req) },
    { method: "POST", pattern: /^\/bookings\/?$/, handler: (req) => bookings.createBooking(req) },
    { method: "GET", pattern: /^\/bookings\/(\d+)\/?$/, handler: (_req, p) => bookings.getBooking(Number(p[1])) },
    { method: "PATCH", pattern: /^\/bookings\/(\d+)\/?$/, handler: (req, p) => bookings.updateBooking(Number(p[1]), req) },
    { method: "DELETE", pattern: /^\/bookings\/(\d+)\/?$/, handler: (_req, p) => bookings.deleteBooking(Number(p[1])) },
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
                resources: ["owners", "dogs", "staff", "bookings"],
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
