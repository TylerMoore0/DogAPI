import { z } from "zod";

// Shared helpers
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");
const isoDateTime = z.string().datetime({ offset: true }).or(
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "Must be ISO 8601 datetime"),
);
const email = z.string().email();
const phone = z.string().min(7).max(32);

// Owner schemas
export const createOwnerSchema = z.object({
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    email: email,
    phone: phone,
    address: z.string().max(300).optional(),
    emergency_contact_name: z.string().max(200).optional(),
    emergency_contact_phone: phone.optional(),
});

export const updateOwnerSchema = createOwnerSchema.partial();

// Dog schemas
export const createDogSchema = z.object({
    owner_id: z.number().int().positive(),
    name: z.string().min(1).max(100),
    breed: z.string().max(100).optional(),
    age_years: z.number().int().min(0).max(30),
    weight_kg: z.number().positive().max(150),
    vaccination_expiry: isoDate,
    feeding_notes: z.string().max(500).optional(),
    behavior_notes: z.string().max(500).optional(),
});

export const updateDogSchema = createDogSchema.partial();

// Staff schemas
export const staffRoles = ["handler", "manager", "trainer", "receptionist"] as const;

export const createStaffSchema = z.object({
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    email: email,
    role: z.enum(staffRoles),
    hired_date: isoDate,
    active: z.boolean().optional().default(true),
});

export const updateStaffSchema = createStaffSchema.partial();

// Booking schemas
export const serviceTypes = ["half_day", "full_day", "overnight"] as const;
export const bookingStatuses = ["scheduled", "checked_in", "checked_out", "cancelled"] as const;

export const createBookingSchema = z.object({
    dog_id: z.number().int().positive(),
    staff_id: z.number().int().positive().optional().nullable(),
    booking_date: isoDate,
    check_in_time: isoDateTime,
    check_out_time: isoDateTime.optional().nullable(),
    service_type: z.enum(serviceTypes),
    status: z.enum(bookingStatuses).optional().default("scheduled"),
    notes: z.string().max(500).optional().nullable(),
});

export const updateBookingSchema = createBookingSchema.partial();

// Parse request body with Zod
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        throw new Error("Request body is not valid JSON");
    }
    return schema.parse(raw);
}
