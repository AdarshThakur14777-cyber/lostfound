import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/http";
import { readImage } from "@/lib/upload";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded photos. Images are stored without metadata (EXIF/GPS is
 * stripped at upload time), so nothing can leak through this endpoint.
 */
export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ name: string }> }) => {
  const { name } = await ctx.params;
  const buffer = await readImage(name);
  if (!buffer) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
