import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

type Params = Record<string, string | number | undefined>;

function buildQuery(params?: Params): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${qs.toString()}`;
}

export function useList<T>(resource: string, params?: Params) {
  return useQuery({
    queryKey: [resource, params ?? {}],
    queryFn: () => api<T[]>(`/api/v1/${resource}${buildQuery(params)}`),
  });
}

export function useCreate<TIn, TOut = unknown>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TIn) =>
      api<TOut>(`/api/v1/${resource}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}

export function useUpdate<TIn, TOut = unknown>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TIn }) =>
      api<TOut>(`/api/v1/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}

export function useRemove(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/${resource}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource] }),
  });
}
