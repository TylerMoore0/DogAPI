export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

export interface PaginationEnvelope {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(url: URL): PaginationParams {
    const pageRaw = url.searchParams.get("page");
    const limitRaw = url.searchParams.get("limit");

    const page = Math.max(1, Number.isFinite(Number(pageRaw)) ? parseInt(pageRaw ?? "1", 10) : 1);
    const requestedLimit = Number.isFinite(Number(limitRaw)) ? parseInt(limitRaw ?? String(DEFAULT_LIMIT), 10) : DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

export function buildEnvelope<T>(
    data: T[],
    total: number,
    params: PaginationParams,
): { data: T[]; pagination: PaginationEnvelope } {
    return {
        data,
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            total_pages: Math.max(1, Math.ceil(total / params.limit)),
        },
    };
}
