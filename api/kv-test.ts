import type { NextApiRequest, NextApiResponse } from "next";
import { kv } from "@vercel/kv";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // write
    await kv.set("yoy:kv_test", { ok: true, at: new Date().toISOString() });

    // read
    const v = await kv.get("yoy:kv_test");

    return res.status(200).json({ success: true, value: v });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
}
