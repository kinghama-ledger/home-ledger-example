// API 가 "지금 요청한 사람이 누구인가" 를 확인하는 곳. 서버 전용.
import "server-only";

import { NextResponse } from "next/server";

import { requestDb } from "@/lib/backend/request";

import { displayNameOf } from "./identity";
import { isAuthOutage } from "./outage";

export type SignedInUser = { id: string; name: string; email: string };

export type SignedInResult =
  | { state: "signed-in"; user: SignedInUser }
  | { state: "signed-out" }
  | { state: "outage" };

export type AccessDenied = Exclude<SignedInResult, { state: "signed-in" }>;

// 쿠키에 든 값을 믿지 않고 Supabase 인증 서버에 물어 검증한다.
export async function getSignedInUser(): Promise<SignedInResult> {
  try {
    const db = await requestDb();
    const { data, error } = await db.auth.getUser();
    if (data.user) {
      return {
        state: "signed-in",
        user: {
          id: data.user.id,
          name: displayNameOf(data.user),
          email: data.user.email ?? "",
        },
      };
    }
    return error && isAuthOutage(error) ? { state: "outage" } : { state: "signed-out" };
  } catch (error) {
    if (isAuthOutage(error)) return { state: "outage" };
    throw error;
  }
}

export function denyAccess(result: AccessDenied): NextResponse {
  if (result.state === "outage") {
    return NextResponse.json(
      { error: "인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}
