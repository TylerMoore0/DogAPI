# DogAPI — Dog Daycare REST API

A REST API for managing a dog daycare facility, built with Bun and SQLite. Group project for COMP 74 (Web Services).

## What this does

The API exposes four resources — **owners**, **dogs**, **staff**, and **bookings** — with full CRUD operations, filtering, pagination, structured error responses, and cross-resource business rule validation. It is designed as if it will be consumed by a third-party client application.

## Quick start

You need [Bun](https://bun.sh) version 1.0 or higher.

```bash
bun install
bun run db:reset    # Create the SQLite database and seed sample data
bun run dev         # Start the API on http://localhost:3000
```

Verify the API is running:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/owners
```

## Resources and relationships

An owner has many dogs. A dog has many bookings. Staff members are assigned to bookings as handlers, and a booking may optionally have a staff assignment. Deleting an owner cascades to their dogs and bookings. Deleting a staff member leaves existing bookings in place but clears the staff reference.

## Project structure

```
DogAPI/
├── src/
│   ├── server.ts             Entry point and request router
│   ├── db/
│   │   ├── connection.ts     SQLite connection singleton
│   │   ├── schema.sql        Table definitions and constraints
│   │   └── seed.ts           Populates sample data
│   ├── lib/
│   │   ├── errors.ts         ApiError class and consistent error responses
│   │   ├── pagination.ts     Parses page/limit query params, builds envelopes
│   │   └── validation.ts     Zod schemas for every resource
│   └── routes/
│       ├── owners.ts         CRUD for owners, plus nested /owners/:id/dogs
│       ├── dogs.ts           CRUD for dogs, with breed and vaccination filters
│       ├── staff.ts          CRUD for staff, with role and active filters
│       └── bookings.ts       CRUD for bookings, with date and status filters
├── docs/
│   └── openapi.yaml          OpenAPI 3.0 specification
├── postman/
│   └── collection.json       Importable Postman collection
└── README.md
```

## Error response shape

Every error response uses the same JSON envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { "fieldErrors": { "email": ["Invalid email"] } }
  }
}
```

Possible codes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `BUSINESS_RULE_VIOLATION`, `BAD_REQUEST`, `METHOD_NOT_ALLOWED`, `INTERNAL_ERROR`.

## Pagination envelope

List endpoints return a consistent envelope:

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 47, "total_pages": 3 }
}
```

Query parameters: `?page=1&limit=20` (limit is capped at 100).

## HTTP status codes

| Status | Meaning |
|--------|---------|
| 200 | Successful read or update |
| 201 | Resource created |
| 204 | Resource deleted (no body) |
| 400 | Bad request or validation error |
| 404 | Resource not found |
| 405 | Method not allowed for this path |
| 409 | Conflict (duplicate unique field) |
| 422 | Business rule violation |
| 500 | Unexpected server error |

## Example requests

Create an owner:

```bash
curl -X POST http://localhost:3000/owners \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jordan","last_name":"Lee","email":"jordan@example.com","phone":"613-555-0199"}'
```

List bookings in a date range, scheduled only:

```bash
curl "http://localhost:3000/bookings?date_from=2026-04-17&date_to=2026-04-20&status=scheduled"
```

List dogs belonging to a specific owner:

```bash
curl http://localhost:3000/owners/1/dogs
```

## Documentation and testing

The OpenAPI specification in `docs/openapi.yaml` documents every endpoint. Open it in [Swagger Editor](https://editor.swagger.io/) to browse and try requests interactively.

The Postman collection in `postman/collection.json` contains requests for every endpoint, including examples that demonstrate validation errors and business rule violations. Import the file into Postman and set the `baseUrl` variable to `http://localhost:3000`.

## Business rules enforced on bookings

The bookings endpoint demonstrates cross-resource validation:
- A booking is rejected if the dog's vaccination expires before the booking date
- A booking is rejected if the assigned staff member is inactive
- A booking is rejected if the dog already has a non-cancelled booking on that date
- A booking is rejected if check-out time is not strictly after check-in time

These return HTTP 422 with a `BUSINESS_RULE_VIOLATION` code, distinct from HTTP 400 used for request-shape errors.
