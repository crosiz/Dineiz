export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() || 'GET';
  const hasBody = init?.body !== undefined;

  const defaultHeaders: Record<string, string> = {};
  if (hasBody || !['GET', 'DELETE', 'HEAD'].includes(method)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
    let msg = typeof body === "string" ? body : body?.error || body?.message || "Request failed";
    
    // If it's a validation error, include the issues in the message
    if (typeof body === 'object' && Array.isArray(body?.issues)) {
      const issuesMsg = body.issues.map((i: any) => `${i.path?.join('.') || 'field'}: ${i.message}`).join(', ');
      msg = `${body.message || 'Validation failed'} - ${issuesMsg}`;
    }

    throw new Error(msg);
  }

  return (isJson ? await res.json() : (await res.text() as any)) as T;
}

