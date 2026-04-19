import { db } from "../db/connection.ts";
import { parseBody, createDogSchema, updateDogSchema } from "../lib/validation.ts";
import { parsePagination, buildEnvelope } from "../lib/pagination.ts";
import { notFound, badRequest } from "../lib/errors.ts";

interface DogRow {
    id: number;
    owner_id: number;
    name: string;
    breed: string | null;
    age_years: number;
    weight_kg: number;
    vaccination_expiry: string;
    feeding_notes: string | null;
    behavior_notes: string | null;
    created_at: string;
}

// GET /dogs - list with filtering by breed, owner_id, and vaccination status
export function listDogs(req: Request): Response {
    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const breed = url.searchParams.get("breed")?.trim();
    const ownerId = url.searchParams.get("owner_id");
    const vaccinationStatus = url.searchParams.get("vaccination_status"); // 'current' or 'expired'

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (breed) {
        conditions.push("breed LIKE ?");
        params.push(`%${breed}%`);
    }
    if (ownerId) {
        const parsed = parseInt(ownerId, 10);
        if (Number.isNaN(parsed)) throw badRequest("owner_id must be a valid integer");
        conditions.push("owner_id = ?");
        params.push(parsed);
    }
    if (vaccinationStatus === "current") {
        conditions.push("vaccination_expiry >= date('now')");
    } else if (vaccinationStatus === "expired") {
        conditions.push("vaccination_expiry < date('now')");
    } else if (vaccinationStatus) {
        throw badRequest("vaccination_status must be 'current' or 'expired'");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { n: total } = db.query(`SELECT COUNT(*) as n FROM dogs ${where}`).get(...params) as { n: number };
    const rows = db.query(
        `SELECT * FROM dogs ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    ).all(...params, pagination.limit, pagination.offset) as DogRow[];

    return Response.json(buildEnvelope(rows, total, pagination));
}

export function getDog(id: number): Response {
    const row = db.query("SELECT * FROM dogs WHERE id = ?").get(id) as DogRow | null;
    if (!row) throw notFound("Dog", id);
    return Response.json(row);
}

export async function createDog(req: Request): Promise<Response> {
    const data = await parseBody(req, createDogSchema);

    // Verify owner exists (gives a cleaner error than the FK constraint failure)
    const owner = db.query("SELECT id FROM owners WHERE id = ?").get(data.owner_id);
    if (!owner) throw badRequest(`Owner with id ${data.owner_id} does not exist`);

    const row = db.prepare(`
        INSERT INTO dogs (owner_id, name, breed, age_years, weight_kg, vaccination_expiry, feeding_notes, behavior_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `).get(
        data.owner_id,
        data.name,
        data.breed ?? null,
        data.age_years,
        data.weight_kg,
        data.vaccination_expiry,
        data.feeding_notes ?? null,
        data.behavior_notes ?? null,
    ) as DogRow;

    return Response.json(row, { status: 201 });
}

export async function updateDog(id: number, req: Request): Promise<Response> {
    const existing = db.query("SELECT id FROM dogs WHERE id = ?").get(id);
    if (!existing) throw notFound("Dog", id);

    const data = await parseBody(req, updateDogSchema);
    const keys = Object.keys(data) as (keyof typeof data)[];
    if (keys.length === 0) throw badRequest("No fields to update");

    if (data.owner_id !== undefined) {
        const owner = db.query("SELECT id FROM owners WHERE id = ?").get(data.owner_id);
        if (!owner) throw badRequest(`Owner with id ${data.owner_id} does not exist`);
    }

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k] ?? null);

    const row = db.prepare(
        `UPDATE dogs SET ${setClause} WHERE id = ? RETURNING *`,
    ).get(...values, id) as DogRow;

    return Response.json(row);
}

export function deleteDog(id: number): Response {
    const existing = db.query("SELECT id FROM dogs WHERE id = ?").get(id);
    if (!existing) throw notFound("Dog", id);

    db.prepare("DELETE FROM dogs WHERE id = ?").run(id);
    return new Response(null, { status: 204 });
}
