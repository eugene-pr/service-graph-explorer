import type { Problem, ProblemError } from '@sge/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { STATUS_CODES } from 'node:http';
import { z } from 'zod';
import { QueryError } from '../engine/findRoutes.js';

/** Answers an unmatched request instead of a 404 problem, or returns undefined to decline. */
export type NotFoundFallback = (request: FastifyRequest, reply: FastifyReply) => FastifyReply | undefined;

export function sendProblem(reply: FastifyReply, status: number, detail: string, errors?: ProblemError[]) {
  const problem: Problem = {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    ...(errors && { errors }),
  };
  return reply.code(status).type('application/problem+json').send(problem);
}

/** Every error leaves as RFC 7807 problem details; stack traces stay in the server log. */
export function useProblemDetails(app: FastifyInstance, notFoundFallback?: NotFoundFallback) {
  app.setNotFoundHandler(
    (request, reply) => notFoundFallback?.(request, reply) ?? sendProblem(reply, 404, `No route for ${request.method} ${request.url}.`),
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof QueryError) {
      return sendProblem(reply, 400, 'The Query is invalid.', error.errors);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      // Union errors normally stop at `query`; recover the leaf's location for malformed params.
      const schema = request.routeOptions.schema?.body;
      const parsed = error.validationContext === 'body' && schema instanceof z.ZodType ? schema.safeParse(request.body) : undefined;
      const filterErrors = parsed && !parsed.success ? filterShapeErrors(parsed.error.issues, request.body) : [];
      if (filterErrors.length > 0) return sendProblem(reply, 400, 'The Query is invalid.', filterErrors);
      const errors = error.validation.map((issue) => ({
        param: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        message: issue.message ?? 'Invalid value.',
      }));
      return sendProblem(reply, 400, `The request's ${error.validationContext ?? 'input'} is invalid.`, errors);
    }
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
      && error.statusCode >= 400 && error.statusCode < 500) {
      return sendProblem(reply, error.statusCode, error.message);
    }
    request.log.error(error);
    return sendProblem(reply, 500, 'Something went wrong on the server.');
  });
}

/** Zod union branches hold relative paths; accumulate them to locate the submitted Filter. */
function filterShapeErrors(issues: readonly z.ZodIssue[], body: unknown, prefix: PropertyKey[] = []): ProblemError[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union') return issue.errors.flatMap((branch) => filterShapeErrors(branch, body, path));
    if (path.at(-1) !== 'params') return [];
    const leafPath = path.slice(0, -1);
    const leaf = leafPath.reduce<unknown>(
      (value, key): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined,
      body,
    );
    if (typeof leaf !== 'object' || leaf === null || !('filter' in leaf) || typeof leaf.filter !== 'string') return [];
    return [{ filter: leaf.filter, param: 'params', path: leafPath.map(String).join('.'), message: issue.message }];
  });
}
