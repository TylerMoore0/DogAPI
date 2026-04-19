import { db } from "../db/connection.ts";
import { parseBody, createStaffSchema, updateStaffSchema, staffRoles } from "../lib/validation.ts";
import { parsePagination, buildEnvelope } from "../lib/pagination.ts";
import { notFound, badRequest } from "../lib/errors.ts";

interface StaffRow {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    hired_date: string;
    active: number;
    created_at: string;
}

// GET /staff - list with filtering by role and active status
export function listStaff(req: Request): Response {
    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const role = url.searchParams.get("role");
    const activeParam = url.searchParams.get("active");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (role) {
        if (!staffRoles.includes(role as typeof staffRoles[number])) {
            throw badRequest(`role must be one of: ${staffRoles.join(", ")}`);
        }
        conditions.push("role = ?");
        params.push(role);
    }
    if (activeParam !== null) {
        if (activeParam !== "true" && activeParam !== "false") {
            throw badRequest("active must be 'true' or 'false'");
        }
        conditions.push("active = ?");
        params.push(activeParam === "true" ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { n: total } = db.query(`SELECT COUNT(*) as n FROM staff ${where}`).get(...params) as { n: number };
    const rows = db.query(
        `SELECT * FROM staff ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
    ).all(...params, pagination.limit, pagination.offset) as StaffRow[];

    return Response.json(buildEnvelope(rows, total, pagination));
}

export function getStaff(id: number): Response {
    const row = db.query("SELECT * FROM staff WHERE id = ?").get(id) as StaffRow | null;
    if (!row) throw notFound("Staff", id);
    return Response.json(row);
}

export async function createStaff(req: Request): Promise<Response> {
    const data = await parseBody(req, createStaffSchema);

    const row = db.prepare(`
        INSERT INTO staff (first_name, last_name, email, role, hired_date, active)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
    `).get(
        data.first_name,
        data.last_name,
        data.email,
        data.role,
        data.hired_date,
        data.active ? 1 : 0,
    ) as StaffRow;

    return Response.json(row, { status: 201 });
}

export async function updateStaff(id: number, req: Request): Promise<Response> {
    const existing = db.query("SELECT id FROM staff WHERE id = ?").get(id);
    if (!existing) throw notFound("Staff", id);

    const data = await parseBody(req, updateStaffSchema);
    const keys = Object.keys(data) as (keyof typeof data)[];
    if (keys.length === 0) throw badRequest("No fields to update");

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => {
        const v = data[k];
        if (k === "active" && typeof v === "boolean") return v ? 1 : 0;
        return v ?? null;
    });

    const row = db.prepare(
        `UPDATE staff SET ${setClause} WHERE id = ? RETURNING *`,
    ).get(...values, id) as StaffRow;

    return Response.json(row);
}

export function deleteStaff(id: number): Response {
    const existing = db.query("SELECT id FROM staff WHERE id = ?").get(id);
    if (!existing) throw notFound("Staff", id);

    db.prepare("DELETE FROM staff WHERE id = ?").run(id);
    return new Response(null, { status: 204 });
}
