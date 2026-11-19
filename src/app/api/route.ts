import { NextResponse } from "next/server";
import { loadDatasetProvenance } from "@/lib/goldprism/historical-store";

export async function GET() {
  try {
    const provenance = loadDatasetProvenance();
    const firestoreConfigured = Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );
    const databaseConfigured = Boolean(process.env.DATABASE_URL);

    return NextResponse.json({
      status: "ok",
      service: "GoldPrism API",
      checks: {
        historicalArchive: {
          status: "ready",
          range: [provenance.dateRangeStart, provenance.dateRangeEnd],
        },
        firestore: {
          status: firestoreConfigured ? "configured" : "not_configured",
        },
        postgresArchive: {
          status: databaseConfigured ? "configured" : "not_configured",
        },
      },
    });
  } catch (error) {
    console.error("API health check failed:", error);
    return NextResponse.json(
      {
        status: "degraded",
        service: "GoldPrism API",
        checks: {
          historicalArchive: { status: "unavailable" },
          firestore: {
            status:
              process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
              process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
                ? "configured"
                : "not_configured",
          },
          postgresArchive: {
            status: process.env.DATABASE_URL ? "configured" : "not_configured",
          },
        },
      },
      { status: 503 }
    );
  }
}