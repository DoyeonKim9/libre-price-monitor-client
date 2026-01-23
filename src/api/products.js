import { apiFetch } from "./http";

export const getHealth = () => apiFetch("/health");
export const getLatestProducts = () => apiFetch("/products/latest");
export const getLowestProducts = (limit = 10) =>
  apiFetch(`/products/lowest?limit=${limit}`);
