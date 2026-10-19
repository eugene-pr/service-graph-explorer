import { SEVERITIES, type GraphNode, type Severity } from '@sge/domain';

const severityRank = (severity: Severity): number => SEVERITIES.indexOf(severity);

export function highestSeverity(node: Pick<GraphNode, 'vulnerabilities'>): Severity | undefined {
  let highest: Severity | undefined;
  for (const { severity } of node.vulnerabilities) {
    if (highest === undefined || severityRank(severity) > severityRank(highest)) highest = severity;
  }
  return highest;
}
