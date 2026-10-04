import type { operations } from "@octokit/openapi-types";
import type { Schema } from "effect";
import { HttpClientRequest } from "effect/http";

// GitHub's own description of its REST API, keyed by operation id as its documentation names them.
type Operation = keyof operations;
type Json<T> = T extends { readonly content: { readonly "application/json": infer A } } ? A : never;
type Success<O extends Operation> = keyof operations[O]["responses"] & (200 | 201 | 202);
type ResponseBody<O extends Operation> = Json<operations[O]["responses"][Success<O>]>;
type RequestBody<O extends Operation> = operations[O] extends { readonly requestBody?: infer B }
  ? Json<NonNullable<B>>
  : never;

/** The schema, provided every response GitHub documents for the operation decodes with it. */
type ResponseSchema<O extends Operation, S extends Schema.Top> = S &
  ([ResponseBody<O>] extends [S["Encoded"]] ? unknown : { readonly mismatch: O });

/**
 * A schema for the fields read from an operation's response, which doesn't compile unless
 * GitHub's documented response decodes with it. The rest of the response is ignored.
 */
export const responseOf =
  <O extends Operation>() =>
  <S extends Schema.Top>(schema: ResponseSchema<O, S>): S =>
    schema;

/** Sets the JSON body GitHub documents for the operation. */
export const bodyOf = <O extends Operation>(
  body: RequestBody<O>,
): ((request: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest) =>
  HttpClientRequest.bodyJsonUnsafe(body);
