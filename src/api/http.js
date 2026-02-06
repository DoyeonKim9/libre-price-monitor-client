const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function normalizeBaseUrl(url) {
  if (!url) return "";
  // 공백 제거
  url = url.trim();
  // 마지막 '/' 제거
  return url.replace(/\/+$/, "");
}

function normalizePath(path) {
  if (!path) return "/";
  // path가 "products/latest"처럼 들어올 수도 있으니 앞에 '/' 보장
  return path.startsWith("/") ? path : `/${path}`;
}

const BASE_URL = normalizeBaseUrl(RAW_BASE_URL);

export async function apiFetch(path, options = {}) {
  if (!BASE_URL) throw new Error("VITE_API_BASE_URL is not set");

  const url = `${BASE_URL}${normalizePath(path)}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {}),
    },
  });

  // ✅ JSON이 아닌 HTML이 오면 여기서 바로 잡히게
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} - ${text}`);
  }
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected JSON but got ${contentType}. Body: ${text.slice(0, 200)}`);
  }

  return res.json();
}
