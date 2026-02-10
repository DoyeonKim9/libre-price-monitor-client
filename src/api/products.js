import { apiFetch } from "./http";

export const getHealth = () => apiFetch("/health");
export const getLatestProducts = () => apiFetch("/products/latest");
export const getLowestProducts = (limit = 10) =>
  apiFetch(`/products/lowest?limit=${limit}`);

// 새 엔드포인트
export const getProductsConfig = () => apiFetch("/products/config");
export const getProductsBelowTarget = () => apiFetch("/products/below-target");
export const getTrackedMallsSummary = () =>
  apiFetch("/products/tracked-malls/summary");
export const getTrackedMallsTrends = () =>
  apiFetch("/products/tracked-malls/trends");
