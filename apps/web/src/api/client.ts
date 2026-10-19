import { FiltersResponse, GraphResponse, Problem, RoutesResponse } from '@sge/domain';

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

async function getJson<T>(url: string, schema: { parse(data: unknown): T }): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const problem = Problem.safeParse(await res.json().catch(() => undefined));
    if (problem.success) throw new ApiError(problem.data.detail ?? problem.data.title, problem.data);
    throw new ApiError(`Request to ${url} failed: ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const fetchGraph = () => getJson('/api/graph', GraphResponse);

export const fetchFilters = () => getJson('/api/filters', FiltersResponse);

export const fetchRoutes = (queryString: URLSearchParams) => {
  const query = queryString.toString();
  return getJson(`/api/routes${query ? `?${query}` : ''}`, RoutesResponse);
};
