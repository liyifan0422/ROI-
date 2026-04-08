import axios from "axios";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const api = axios.create({ baseURL: BASE, withCredentials: true });

export interface TableMeta {
  name: string;
  rows: number;
  columns: string[];
}

export interface FieldMeta {
  name: string;
  type: "numeric" | "datetime" | "string";
}

export interface JoinConfig {
  left: string;
  right: string;
  left_on: string;
  right_on: string;
  how: "left" | "inner" | "outer" | "right";
}

export interface ValueConfig {
  field: string;
  agg: "sum" | "mean" | "count" | "min" | "max";
}

export interface PivotRequest {
  table: string;
  rows: string[];
  columns: string[];
  values: ValueConfig[];
  total_cost?: number;
  roi_formula?: string;
}

export interface TrendRequest {
  table: string;
  date_field: string;
  metric_field: string;
  agg: string;
  dimension_field?: string;
  dimension_values?: string[];
  date_start?: string;
  date_end?: string;
}

export const uploadFiles = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return api.post<{ tables: TableMeta[] }>("/api/upload", fd);
};

export const listTables = () => api.get<{ tables: TableMeta[] }>("/api/tables");

export const deleteTable = (name: string) =>
  api.delete(`/api/tables/${encodeURIComponent(name)}`);

export const previewTable = (name: string) =>
  api.get<{ columns: string[]; rows: Record<string, unknown>[] }>(
    `/api/tables/${encodeURIComponent(name)}/preview`
  );

export const getFields = (name: string) =>
  api.get<{ fields: FieldMeta[] }>(
    `/api/tables/${encodeURIComponent(name)}/fields`
  );

export const joinTables = (joins: JoinConfig[], result_name: string) =>
  api.post<TableMeta>("/api/join", { joins, result_name });

export const runPivot = (req: PivotRequest) =>
  api.post<{ columns: string[]; rows: Record<string, unknown>[] }>(
    "/api/pivot",
    req
  );

export const runTrend = (req: TrendRequest) =>
  api.post<{
    series: { name: string; data: { date: string; value: number }[] }[];
  }>("/api/trend", req);
