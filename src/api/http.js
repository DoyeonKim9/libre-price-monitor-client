const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch(path, options = {}) {
  if (!BASE_URL) throw new Error("VITE_API_BASE_URL is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}
