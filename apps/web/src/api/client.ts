import { HealthResponse } from '@sge/domain';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return HealthResponse.parse(await res.json());
}
