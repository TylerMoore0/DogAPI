-- Dog Daycare API Schema
-- Enforces referential integrity and domain constraints at the database level
-- so the API layer can trust the data it reads back.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS dogs;
DROP TABLE IF EXISTS owners;
DROP TABLE IF EXISTS staff;

CREATE TABLE owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    breed TEXT,
    age_years INTEGER NOT NULL CHECK (age_years >= 0 AND age_years <= 30),
    weight_kg REAL NOT NULL CHECK (weight_kg > 0 AND weight_kg < 150),
    vaccination_expiry TEXT NOT NULL,
    feeding_notes TEXT,
    behavior_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('handler', 'manager', 'trainer', 'receptionist')),
    hired_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dog_id INTEGER NOT NULL,
    staff_id INTEGER,
    booking_date TEXT NOT NULL,
    check_in_time TEXT NOT NULL,
    check_out_time TEXT,
    service_type TEXT NOT NULL CHECK (service_type IN ('half_day', 'full_day', 'overnight')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'checked_out', 'cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_dogs_owner_id ON dogs(owner_id);
CREATE INDEX idx_bookings_dog_id ON bookings(dog_id);
CREATE INDEX idx_bookings_staff_id ON bookings(staff_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
