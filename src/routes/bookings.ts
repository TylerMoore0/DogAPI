import { db } from "../db/connection.ts";
import { parseBody, createBookingSchema, updateBookingSchema, bookingStatuses, serviceTypes } from "../lib/validation.ts";
import { parsePagination, buildEnvelope } from "../lib/pagination.ts";
import { notFound, badRequest, businessRule } from "../lib/errors.ts";

interface BookingRow {
    id: number;
    dog_id: number;
    staff_id: number | null;
    booking_date: string;
    check_in_time: string;
    check_out_time: string | null;
    service_type: string;
    status: string;
    notes: string | null;
    created_at: string;
}

// GET /bookings - list with filtering by date range, dog_id, staff_id, status, service_type
export function listBookings(req: Request): Response {
    const url = new URL(req.url);
    const pagination = parsePagination(url);

    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const dogId = url.searchParams.get("dog_id");
    const staffId = url.searchParams.get("staff_id");
    const status = url.searchParams.get("status");
    const serviceType = url.searchParams.get("service_type");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (dateFrom) {
        conditions.push("booking_date >= ?");
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push("booking_date <= ?");
        params.push(dateTo);
    }
    if (dogId) {
        const parsed = parseInt(dogId, 10);
        if (Number.isNaN(parsed)) throw badRequest("dog_id must be an integer");
        conditions.push("dog_id = ?");
        params.push(parsed);
    }
    if (staffId) {
        const parsed = parseInt(staffId, 10);
        if (Number.isNaN(parsed)) throw badRequest("staff_id must be an integer");
        conditions.push("staff_id = ?");
        params.push(parsed);
    }
    if (status) {
        if (!bookingStatuses.includes(status as typeof bookingStatuses[number])) {
            throw badRequest(`status must be one of: ${bookingStatuses.join(", ")}`);
        }
        conditions.push("status = ?");
        params.push(status);
    }
    if (serviceType) {
        if (!serviceTypes.includes(serviceType as typeof serviceTypes[number])) {
            throw badRequest(`service_type must be one of: ${serviceTypes.join(", ")}`);
        }
        conditions.push("service_type = ?");
        params.push(serviceType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { n: total } = db.query(`SELECT COUNT(*) as n FROM bookings ${where}`).get(...params) as { n: number };
    const rows = db.query(
        `SELECT * FROM bookings ${where} ORDER BY booking_date ASC, check_in_time ASC LIMIT ? OFFSET ?`,
    ).all(...params, pagination.limit, pagination.offset) as BookingRow[];

    return Response.json(buildEnvelope(rows, total, pagination));
}

export function getBooking(id: number): Response {
    const row = db.query("SELECT * FROM bookings WHERE id = ?").get(id) as BookingRow | null;
    if (!row) throw notFound("Booking", id);
    return Response.json(row);
}

export async function createBooking(req: Request): Promise<Response> {
    const data = await parseBody(req, createBookingSchema);

    // Verify dog exists and check vaccination
    const dog = db.query(
        "SELECT id, vaccination_expiry FROM dogs WHERE id = ?",
    ).get(data.dog_id) as { id: number; vaccination_expiry: string } | null;
    if (!dog) throw badRequest(`Dog with id ${data.dog_id} does not exist`);

    if (dog.vaccination_expiry < data.booking_date) {
        throw businessRule(
            "Dog's vaccination has expired before the booking date",
            { vaccination_expiry: dog.vaccination_expiry, booking_date: data.booking_date },
        );
    }

    // Verify staff exists and is active
    if (data.staff_id != null) {
        const staff = db.query(
            "SELECT id, active FROM staff WHERE id = ?",
        ).get(data.staff_id) as { id: number; active: number } | null;
        if (!staff) throw badRequest(`Staff with id ${data.staff_id} does not exist`);
        if (staff.active === 0) throw businessRule("Cannot assign an inactive staff member to a booking");
    }

    // Check out time must be after check in time
    if (data.check_out_time && data.check_out_time <= data.check_in_time) {
        throw businessRule("check_out_time must be after check_in_time");
    }

    // No overlapping non-cancelled bookings for the same dog on the same date
    const conflict = db.query(`
        SELECT id FROM bookings
        WHERE dog_id = ? AND booking_date = ? AND status != 'cancelled'
    `).get(data.dog_id, data.booking_date);
    if (conflict) {
        throw businessRule(
            "This dog already has an active booking on that date",
            { dog_id: data.dog_id, booking_date: data.booking_date },
        );
    }

    const row = db.prepare(`
        INSERT INTO bookings (dog_id, staff_id, booking_date, check_in_time, check_out_time, service_type, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `).get(
        data.dog_id,
        data.staff_id ?? null,
        data.booking_date,
        data.check_in_time,
        data.check_out_time ?? null,
        data.service_type,
        data.status ?? "scheduled",
        data.notes ?? null,
    ) as BookingRow;

    return Response.json(row, { status: 201 });
}

export async function updateBooking(id: number, req: Request): Promise<Response> {
    const existing = db.query("SELECT * FROM bookings WHERE id = ?").get(id) as BookingRow | null;
    if (!existing) throw notFound("Booking", id);

    const data = await parseBody(req, updateBookingSchema);
    const keys = Object.keys(data) as (keyof typeof data)[];
    if (keys.length === 0) throw badRequest("No fields to update");

    // Cross-field validation on the merged values
    const merged = { ...existing, ...data };
    if (merged.check_out_time && merged.check_out_time <= merged.check_in_time) {
        throw businessRule("check_out_time must be after check_in_time");
    }

    if (data.staff_id != null) {
        const staff = db.query("SELECT active FROM staff WHERE id = ?").get(data.staff_id) as { active: number } | null;
        if (!staff) throw badRequest(`Staff with id ${data.staff_id} does not exist`);
        if (staff.active === 0) throw businessRule("Cannot assign an inactive staff member to a booking");
    }

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k] ?? null);

    const row = db.prepare(
        `UPDATE bookings SET ${setClause} WHERE id = ? RETURNING *`,
    ).get(...values, id) as BookingRow;

    return Response.json(row);
}

export function deleteBooking(id: number): Response {
    const existing = db.query("SELECT id FROM bookings WHERE id = ?").get(id);
    if (!existing) throw notFound("Booking", id);

    db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    return new Response(null, { status: 204 });
}
