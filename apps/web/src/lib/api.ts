import type { Meta, PostDetail, PostsPage, PostsQuery } from "@farseer/shared";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export function postsUrl(q: PostsQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v == null || v === false || (Array.isArray(v) && v.length === 0) || v === "") continue;
    p.set(k, Array.isArray(v) ? v.join(",") : v === true ? "1" : String(v));
  }
  const s = p.toString();
  return `/api/posts${s ? `?${s}` : ""}`;
}

export const api = {
  posts: (q: PostsQuery) => get<PostsPage>(postsUrl(q)),
  post: (id: number) => get<PostDetail>(`/api/posts/${id}`),
  meta: () => get<Meta>("/api/meta"),
};
