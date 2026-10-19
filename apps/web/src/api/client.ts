import { GraphResponse } from '@sge/domain';

export async function fetchGraph(): Promise<GraphResponse> {
  const res = await fetch('/api/graph');
  if (!res.ok) throw new Error(`Graph request failed: ${res.status}`);
  return GraphResponse.parse(await res.json());
}
