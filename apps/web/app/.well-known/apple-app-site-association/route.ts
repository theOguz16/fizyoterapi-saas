import { NextResponse } from "next/server";

const ASSOCIATION = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "75HL8KU3H9.com.fizyoflow.mobile",
        paths: ["/join/*"],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(ASSOCIATION, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
