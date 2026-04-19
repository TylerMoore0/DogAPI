import { ZodError } from "zod";

export type ErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "BUSINESS_RULE_VIOLATION"
    | "BAD_REQUEST"
    | "INTERNAL_ERROR";

export interface ApiErrorBody {
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
    };
}

export class ApiError extends Error {
    constructor(
        public status: number,
        public code: ErrorCode,
        message: string,
        public details?: unknown,
    ) {
        super(message);
    }

    toResponse(): Response {
        const body: ApiErrorBody = {
            error: {
                code: this.code,
                message: this.message,
                ...(this.details !== undefined && { details: this.details }),
            },
        };
        return Response.json(body, { status: this.status });
    }
}

export const notFound = (resource: string, id: string | number) =>
    new ApiError(404, "NOT_FOUND", `${resource} with id ${id} not found`);

export const conflict = (message: string, details?: unknown) =>
    new ApiError(409, "CONFLICT", message, details);

export const badRequest = (message: string, details?: unknown) =>
    new ApiError(400, "BAD_REQUEST", message, details);

export const businessRule = (message: string, details?: unknown) =>
    new ApiError(422, "BUSINESS_RULE_VIOLATION", message, details);

export function handleError(err: unknown): Response {
    if (err instanceof ApiError) {
        return err.toResponse();
    }
    if (err instanceof ZodError) {
        return new ApiError(400, "VALIDATION_ERROR", "Request validation failed", err.flatten()).toResponse();
    }
    // SQLite constraint violations
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return new ApiError(409, "CONFLICT", "A record with this unique field already exists").toResponse();
    }
    if (err instanceof Error && err.message.includes("FOREIGN KEY constraint failed")) {
        return new ApiError(400, "BAD_REQUEST", "Referenced record does not exist").toResponse();
    }
    if (err instanceof Error && err.message.includes("CHECK constraint failed")) {
        return new ApiError(400, "VALIDATION_ERROR", "Value violates a database constraint", err.message).toResponse();
    }

    console.error("Unhandled error:", err);
    return new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred").toResponse();
}
