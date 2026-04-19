import { db } from "../db/connection.ts";
import { parseBody, createOwnerSchema, updateOwnerSchema } from "../lib/validation.ts";
import { parsePagination, buildEnvelope } from "../lib/pagination.ts";
import { notFound, badRequest } from "../lib/errors.ts";

interface OwnerRow {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    created_at: string;
}

// GET /owners - list with pagination and optional search
export function listOwners(req: Request): Response {
    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const search = url.searchParams.get("search")?.trim();

    let where = "";
    const params: unknown[] = [];

    if (search) {
        where = "WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?";
        const like = `%${search}%`;
        params.push(like, like, like);
    }

    const countQuery = db.query(`SELECT COUNT(*) as n FROM owners ${where}`);
    const { n: total } = countQuery.get(...params) as { n: number };

    const listQuery = db.query(
        `SELECT * FROM owners ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    );
    const rows = listQuery.all(...params, pagination.limit, pagination.offset) as OwnerRow[];

    return Response.json(buildEnvelope(rows, total, pagination));
}

// GET /owners/:id
export function getOwner(id: number): Response {
    const row = db.query("SELECT * FROM owners WHERE id = ?").get(id) as OwnerRow | null;
    if (!row) throw notFound("Owner", id);
    return Response.json(row);
}

// GET /owners/:id/dogs - nested resource
export function getOwnerDogs(id: number, req: Request): Response {
    const owner = db.query("SELECT id FROM owners WHERE id = ?").get(id);
    if (!owner) throw notFound("Owner", id);

    const pagination = parsePagination(new URL(req.url));
    const { n: total } = db.query("SELECT COUNT(*) as n FROM dogs WHERE owner_id = ?").get(id) as { n: number };
    const rows = db.query(
        "SELECT * FROM dogs WHERE owner_id = ? ORDER BY id ASC LIMIT ? OFFSET ?",
    ).all(id, pagination.limit, pagination.offset);

    return Response.json(buildEnvelope(rows, total, pagination));
}

// POST /owners
export async function createOwner(req: Request): Promise<Response> {
    const data = await parseBody(req, createOwnerSchema);

    const insert = db.prepare(`
        INSERT INTO owners (first_name, last_name, email, phone, address, emergency_contact_name, emergency_contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `);
    const row = insert.get(
        data.first_name,
        data.last_name,
        data.email,
        data.phone,
        data.address ?? null,
        data.emergency_contact_name ?? null,
        data.emergency_contact_phone ?? null,
    ) as OwnerRow;

    return Response.json(row, { status: 201 });
}

// PATCH /owners/:id
export async function updateOwner(id: number, req: Request): Promise<Response> {
    const existing = db.query("SELECT id FROM owners WHERE id = ?").get(id);
    if (!existing) throw notFound("Owner", id);

    const data = await parseBody(req, updateOwnerSchema);
    const keys = Object.keys(data) as (keyof typeof data)[];
    if (keys.length === 0) throw badRequest("No fields to update");

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k] ?? null);

    const row = db.prepare(
        `UPDATE owners SET ${setClause} WHERE id = ? RETURNING *`,
    ).get(...values, id) as OwnerRow;

    return Response.json(row);
}

// DELETE /owners/:id
export function deleteOwner(id: number): Response {
    const existing = db.query("SELECT id FROM owners WHERE id = ?").get(id);
    if (!existing) throw notFound("Owner", id);

    db.prepare("DELETE FROM owners WHERE id = ?").run(id);
    return new Response(null, { status: 204 });
}
