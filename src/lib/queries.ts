import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { z, type ZodType } from "zod";
import {
  authenticatedFetch,
  type AuthFetchOptions,
} from "./authenticatedFetch";

/**
 * Convenience options:
 * - `schema?` — when set, the response is validated/parsed with Zod before
 *   reaching the component. Cheap insurance against backend drift.
 * - `enabled` defaults to true — same as TanStack Query.
 */
export type AuthQueryOptions<
  TData,
  TSchema extends ZodType = ZodType<TData>,
> = Omit<
  UseQueryOptions<z.infer<TSchema>, Error, z.infer<TSchema>, QueryKey>,
  "queryKey" | "queryFn"
> & {
  schema?: TSchema;
  fetchOptions?: AuthFetchOptions;
};

/**
 * Authenticated GET wrapper around `useQuery`. The query function injects the
 * bearer token, parses the response, and (optionally) validates it.
 *
 * Usage:
 * ```ts
 * const { data, isLoading } = useAuthenticatedQuery({
 *   queryKey: ["contacts"],
 *   url: `${getApiBaseUrl()}/user/v1/contacts`,
 *   schema: ContactListSchema,
 * });
 * ```
 */
export function useAuthenticatedQuery<
  TData,
  TSchema extends ZodType = ZodType<TData>,
>(
  args: {
    queryKey: QueryKey;
    url: string;
  } & AuthQueryOptions<TData, TSchema>,
) {
  const { queryKey, url, schema, fetchOptions, ...rest } = args;
  return useQuery({
    queryKey,
    queryFn: async () => {
      const raw = await authenticatedFetch<unknown>(url, fetchOptions);
      if (schema) {
        return schema.parse(raw) as z.infer<TSchema>;
      }
      return raw as z.infer<TSchema>;
    },
    ...rest,
  });
}

export type AuthMutationOptions<
  TVariables,
  TData,
  TSchema extends ZodType = ZodType<TData>,
> = Omit<
  UseMutationOptions<z.infer<TSchema>, Error, TVariables>,
  "mutationFn"
> & {
  schema?: TSchema;
};

/**
 * Authenticated mutation wrapper. The caller provides a `request` function
 * that maps variables to a `(url, options)` pair — keeps URL/body shaping in
 * one place per endpoint without re-implementing fetch every time.
 */
export function useAuthenticatedMutation<
  TVariables,
  TData,
  TSchema extends ZodType = ZodType<TData>,
>(
  args: {
    request: (variables: TVariables) => {
      url: string;
      options?: AuthFetchOptions;
    };
  } & AuthMutationOptions<TVariables, TData, TSchema>,
) {
  const { request, schema, ...rest } = args;
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const { url, options } = request(variables);
      const raw = await authenticatedFetch<unknown>(url, options);
      if (schema) {
        return schema.parse(raw) as z.infer<TSchema>;
      }
      return raw as z.infer<TSchema>;
    },
    ...rest,
  });
}
