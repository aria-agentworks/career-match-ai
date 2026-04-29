import { NextRequest, NextResponse } from "next/server";
import {
  searchCompanies,
  searchPeople,
  searchPeopleByDomains,
} from "@/lib/explee";

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
    const {
      query,
      type,
      domains,
      jobTitles,
      limit = 20,
    } = body as {
      query?: string;
      type: "companies" | "people" | "domains";
      domains?: string[];
      jobTitles?: string[];
      limit?: number;
    };

    if (!query && type !== "domains") {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required for companies and people search types.",
        },
        { status: 400 }
      );
    }

    if (type === "domains" && (!domains || domains.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Domains array is required when type is 'domains'.",
        },
        { status: 400 }
      );
    }

    let results;

    switch (type) {
      case "companies": {
        const response = await searchCompanies(query!, undefined, limit);
        results = response.companies || response.results || [];
        break;
      }

      case "people": {
        const response = await searchPeople(
          jobTitles || [],
          query,
          undefined,
          limit
        );
        results = response.people || response.results || [];
        break;
      }

      case "domains": {
        const response = await searchPeopleByDomains(
          domains!,
          jobTitles,
          3
        );
        results = response.people || response.results || [];
        break;
      }

      default: {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid search type: ${type}. Must be 'companies', 'people', or 'domains'.`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      results,
      type,
      count: Array.isArray(results) ? results.length : 0,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const status =
      message.includes("EXPLEE_API_KEY") ? 500 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
