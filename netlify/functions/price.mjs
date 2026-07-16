const TWELVE_DATA_API_KEY = "29323895c3884f7aa1c76b42072364e0";

export default async (req) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return new Response(JSON.stringify({ ok: false, error: "missing symbol" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`
    );
    const data = await res.json();

    if (data.status === "error" || !data.price) {
      return new Response(JSON.stringify({ ok: false, error: data.message || "no price returned" }), {
        headers: { "content-type": "application/json" },
      });
    }

    const price = parseFloat(data.price);
    if (isNaN(price)) {
      return new Response(JSON.stringify({ ok: false, error: "unparseable price" }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, price }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/.netlify/functions/price" };
