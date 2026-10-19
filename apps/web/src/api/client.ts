import { FiltersResponse, GraphResponse, Problem, RoutesResponse, type RoutesQueryRequest } from '@sge/domain';

/** A failed API request, with the RFC 7807 problem details when the API sent them. */
export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    message: string,
    readonly problem?: Problem,
  ) {
    super(message);
  }
}

async function fetchJson<T>(url: string, schema: { parse(data: unknown): T }, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const problem = Problem.safeParse(await res.json().catch(() => undefined));
    if (problem.success) throw new ApiError(problem.data.detail ?? problem.data.title, problem.data);
    throw new ApiError(`Request to ${url} failed: ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const fetchGraph = () => fetchJson('/api/graph', GraphResponse);

export const fetchFilters = () => fetchJson('/api/filters', FiltersResponse);

export const fetchRoutes = (queryString: URLSearchParams) => {
  const query = queryString.toString();
  return fetchJson(`/api/routes${query ? `?${query}` : ''}`, RoutesResponse);
};

export const postRoutesQuery = (body: RoutesQueryRequest) =>
  fetchJson('/api/routes/query', RoutesResponse, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
