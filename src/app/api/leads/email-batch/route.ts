import { NextRequest, NextResponse } from "next/server";
import { batchFindEmail, getBatchStatus } from "@/lib/explee";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.EXPLEE_API_KEY || process.env.EXPLEE_API_KEY.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: "EXPLEE_API_KEY is not configured. Please set a valid Explee API key in Vercel environment variables.",
          help: "Get your key at https://explee.com",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { contacts, preset = "basic" } = body as {
      contacts: Array<{
        first_name: string;
        last_name: string;
        company_domain: string;
      }>;
      preset?: string;
    };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "contacts array is required and must not be empty.",
        },
        { status: 400 }
      );
    }

    for (const contact of contacts) {
      if (!contact.first_name || !contact.last_name || !contact.company_domain) {
        return NextResponse.json(
          {
            success: false,
            error: "Each contact must have first_name, last_name, and company_domain.",
          },
          { status: 400 }
        );
      }
    }

    const result = await batchFindEmail(contacts, preset);

    return NextResponse.json({
      success: true,
      taskId: result.task_id,
      status: result.status,
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

export async function GET(request: NextRequest) {
  try {
    if (!process.env.EXPLEE_API_KEY || process.env.EXPLEE_API_KEY.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: "EXPLEE_API_KEY is not configured.",
          help: "Get your key at https://explee.com",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId query parameter is required.",
        },
        { status: 400 }
      );
    }

    const result = await getBatchStatus(taskId);

    return NextResponse.json({
      success: true,
      taskId: result.task_id,
      status: result.status,
      results: result.results || [],
      progress: result.progress || null,
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
