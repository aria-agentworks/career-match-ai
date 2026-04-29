import { NextRequest, NextResponse } from "next/server";
import { findEmail } from "@/lib/explee";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.EXPLEE_API_KEY || process.env.EXPLEE_API_KEY.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: "EXPLEE_API_KEY is not configured. Please set the environment variable.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, companyDomain, preset = "basic" } = body as {
      firstName: string;
      lastName: string;
      companyDomain: string;
      preset?: string;
    };

    if (!firstName || !lastName || !companyDomain) {
      return NextResponse.json(
        {
          success: false,
          error: "firstName, lastName, and companyDomain are required.",
        },
        { status: 400 }
      );
    }

    const result = await findEmail(firstName, lastName, companyDomain, preset);

    return NextResponse.json({
      success: true,
      email: result.email,
      emailStatus: result.email_status,
      meta: result.meta || null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
