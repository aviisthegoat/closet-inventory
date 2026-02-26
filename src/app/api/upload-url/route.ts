import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const body = await request.json();

  const { folder, fileName, fileType } = body as {
    folder: "locations" | "bins";
    fileName: string;
    fileType: string;
  };

  const path = `${folder}/${crypto.randomUUID()}-${fileName}`;

  const { data, error } = await supabase.storage
    .from("closet-photos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to create upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ path, uploadUrl: data.signedUrl });
}

