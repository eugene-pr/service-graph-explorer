import type { Problem, ProblemError } from '@sge/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { STATUS_CODES } from 'node:http';
import { QueryError } from '../engine/findRoutes.js';

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
export function useProblemDetails(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => sendProblem(reply, 404, `No route for ${request.method} ${request.url}.`));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof QueryError) {
      return sendProblem(reply, 400, 'The Query is invalid.', error.errors);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map((issue) => ({
        param: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        message: issue.message ?? 'Invalid value.',
      }));
      return sendProblem(reply, 400, `The request's ${error.validationContext ?? 'input'} is invalid.`, errors);
    }
    request.log.error(error);
    return sendProblem(reply, 500, 'Something went wrong on the server.');
  });
}
