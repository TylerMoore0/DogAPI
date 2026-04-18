import { db, initSchema } from "./connection.ts";

console.log("Resetting database...");
initSchema();

const insertOwner = db.prepare(`
    INSERT INTO owners (first_name, last_name, email, phone, address, emergency_contact_name, emergency_contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertDog = db.prepare(`
    INSERT INTO dogs (owner_id, name, breed, age_years, weight_kg, vaccination_expiry, feeding_notes, behavior_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertStaff = db.prepare(`
    INSERT INTO staff (first_name, last_name, email, role, hired_date, active)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertBooking = db.prepare(`
    INSERT INTO bookings (dog_id, staff_id, booking_date, check_in_time, check_out_time, service_type, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
    // Owners
    const ownerIds: number[] = [];
    const owners = [
        ["Apple", "Zinin", "apple.zinin@example.com", "613-555-0101", "12 Maple St, Kingston ON", "Mark Guanzon", "613-555-0102"],
        ["Raina", "Jin", "raina.jin@example.com", "613-555-0111", "45 Oak Ave, Kingston ON", "Apple Zinin", "613-555-0101"],
        ["Liam", "Patel", "liam.patel@example.com", "613-555-0121", "78 Pine Rd, Kingston ON", "Priya Patel", "613-555-0122"],
        ["Sofia", "Nguyen", "sofia.nguyen@example.com", "613-555-0131", "89 Elm St, Kingston ON", "David Nguyen", "613-555-0132"],
        ["Ethan", "Martinez", "ethan.martinez@example.com", "613-555-0141", "23 Cedar Ln, Kingston ON", "Maria Martinez", "613-555-0142"],
        ["Olivia", "Brown", "olivia.brown@example.com", "613-555-0151", "56 Birch St, Kingston ON", "James Brown", "613-555-0152"],
        ["Noah", "Wilson", "noah.wilson@example.com", "613-555-0161", "101 Willow Way, Kingston ON", "Emily Wilson", "613-555-0162"],
        ["Ava", "Chen", "ava.chen@example.com", "613-555-0171", "34 Aspen Ct, Kingston ON", "Wei Chen", "613-555-0172"],
    ];
    for (const o of owners) {
        const result = insertOwner.run(...o);
        ownerIds.push(Number(result.lastInsertRowid));
    }

    // Dogs
    const dogIds: number[] = [];
    const dogs = [
        [ownerIds[0], "Cricket", "Mixed", 5, 14.5, "2026-08-15", "Sensitive stomach, small meals only", "Recovering from surgery, low-energy play"],
        [ownerIds[0], "Cola", "Labrador", 1, 18.2, "2026-11-20", "Three meals per day", "Puppy, in board and train"],
        [ownerIds[1], "Mochi", "Shiba Inu", 3, 11.0, "2026-05-10", "No table scraps", "Reactive to other small dogs"],
        [ownerIds[2], "Biscuit", "Golden Retriever", 4, 32.5, "2026-09-01", "Standard kibble twice daily", "Loves water, great with other dogs"],
        [ownerIds[3], "Pepper", "Border Collie", 2, 19.0, "2027-01-15", "Grain-free diet", "High energy, needs lots of exercise"],
        [ownerIds[4], "Rocky", "French Bulldog", 6, 12.8, "2026-07-22", "Limited treats, weight management", "Snores loudly when sleeping"],
        [ownerIds[5], "Luna", "Husky", 3, 24.0, "2026-10-05", "Raw diet", "Escape artist, secure gates required"],
        [ownerIds[6], "Max", "German Shepherd", 7, 35.2, "2026-06-18", "Joint supplement with meals", "Older dog, prefers quiet areas"],
        [ownerIds[7], "Bella", "Poodle", 2, 8.5, "2026-12-01", "Small breed formula", "Anxious around loud noises"],
        [ownerIds[7], "Charlie", "Beagle", 5, 13.5, "2026-08-30", "Food motivated, watch for scavenging", "Friendly with everyone"],
    ];
    for (const d of dogs) {
        const result = insertDog.run(...d);
        dogIds.push(Number(result.lastInsertRowid));
    }

    // Staff
    const staffIds: number[] = [];
    const staff = [
        ["Sarah", "Thompson", "sarah.thompson@daycare.example.com", "manager", "2023-03-15", 1],
        ["Jamal", "Williams", "jamal.williams@daycare.example.com", "handler", "2024-01-08", 1],
        ["Priya", "Sharma", "priya.sharma@daycare.example.com", "handler", "2024-06-20", 1],
        ["Connor", "O'Brien", "connor.obrien@daycare.example.com", "trainer", "2023-09-01", 1],
        ["Yuki", "Tanaka", "yuki.tanaka@daycare.example.com", "receptionist", "2025-02-14", 1],
        ["Marcus", "Davis", "marcus.davis@daycare.example.com", "handler", "2022-11-03", 0],
    ];
    for (const s of staff) {
        const result = insertStaff.run(...s);
        staffIds.push(Number(result.lastInsertRowid));
    }

    // Bookings - mix of past, present, and future to demonstrate filtering
    const bookings = [
        [dogIds[0], staffIds[1], "2026-04-15", "2026-04-15T08:00:00", "2026-04-15T17:00:00", "full_day", "checked_out", "Gentle play only"],
        [dogIds[1], staffIds[3], "2026-04-15", "2026-04-15T09:00:00", "2026-04-15T17:00:00", "full_day", "checked_out", "Training focus: leash"],
        [dogIds[2], staffIds[2], "2026-04-16", "2026-04-16T08:30:00", "2026-04-16T13:00:00", "half_day", "checked_out", null],
        [dogIds[3], staffIds[1], "2026-04-17", "2026-04-17T08:00:00", null, "full_day", "checked_in", null],
        [dogIds[4], staffIds[2], "2026-04-17", "2026-04-17T09:00:00", null, "full_day", "checked_in", "Needs extra exercise"],
        [dogIds[5], staffIds[1], "2026-04-17", "2026-04-17T10:00:00", null, "half_day", "scheduled", null],
        [dogIds[6], null, "2026-04-18", "2026-04-18T08:00:00", null, "full_day", "scheduled", "Double-check gate security"],
        [dogIds[7], staffIds[2], "2026-04-18", "2026-04-18T08:30:00", null, "full_day", "scheduled", null],
        [dogIds[8], staffIds[3], "2026-04-19", "2026-04-19T09:00:00", null, "half_day", "scheduled", "Quiet area preferred"],
        [dogIds[9], staffIds[1], "2026-04-20", "2026-04-20T08:00:00", "2026-04-21T17:00:00", "overnight", "scheduled", null],
        [dogIds[0], staffIds[3], "2026-04-22", "2026-04-22T08:00:00", null, "full_day", "scheduled", "Post-surgery check-in"],
        [dogIds[2], null, "2026-04-23", "2026-04-23T08:30:00", null, "half_day", "cancelled", "Owner cancelled"],
    ];
    for (const b of bookings) {
        insertBooking.run(...b);
    }
})();

const ownerCount = db.query("SELECT COUNT(*) as n FROM owners").get() as { n: number };
const dogCount = db.query("SELECT COUNT(*) as n FROM dogs").get() as { n: number };
const staffCount = db.query("SELECT COUNT(*) as n FROM staff").get() as { n: number };
const bookingCount = db.query("SELECT COUNT(*) as n FROM bookings").get() as { n: number };

console.log(`Seeded ${ownerCount.n} owners, ${dogCount.n} dogs, ${staffCount.n} staff, ${bookingCount.n} bookings.`);
console.log("Done.");
