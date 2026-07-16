import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("pfg-market-watch");

  if (req.method === "GET") {
    const value = await store.get("board", { type: "json" });
    return new Response(JSON.stringify(value || null), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json();
    await store.set("board", JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/.netlify/functions/board" };
