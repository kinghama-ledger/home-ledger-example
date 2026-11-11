"use client";

// 마이페이지 — 이름·로그인 ID 수정, 비밀번호 변경, 로그아웃.
import { useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { HhField, HhPageHeader } from "@/components/household/hh-page-header";
import { usePrivacyMode } from "@/components/privacy/privacy-mode";
import { Panel, PanelTitle, Screen } from "@/components/screen/blocks";
import { useAccount } from "@/components/shell/use-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportEvent } from "@/lib/audit/client";
import { browserDb, signOutHere } from "@/lib/backend/browser";
import { LOGIN_PATH } from "@/lib/routes";

// 서버(계정 API)와 같은 한도. 여기서는 보내기 전에 미리 알려 주는 용도다.
const NAME_MAX = 50;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 200;

type ApiResult = { ok: true; data: Record<string, unknown> } | { ok: false; reason: string };

// 계정 API 를 부른다. 실패하면 서버가 준 사유를 그대로 돌려준다.
async function postAccount(path: string, body: Record<string, string>, fallback: string): Promise<ApiResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    if (response.ok) return { ok: true, data: record };
    return { ok: false, reason: typeof record.error === "string" && record.error ? record.error : fallback };
  } catch {
    return { ok: false, reason: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

function AccountPanel() {
  const account = useAccount();
  const { mask, enabled: masked } = usePrivacyMode();
  const [draft, setDraft] = useState<{ displayName: string; loginId: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    const displayName = draft.displayName.trim();
    const loginId = draft.loginId.trim();
    if (!displayName || !loginId) {
      toast.error("이름과 로그인 ID를 모두 입력해 주세요.");
      return;
    }

    setSaving(true);
    const result = await postAccount("/api/account/profile", { displayName, loginId }, "정보를 바꾸지 못했습니다.");
    if (!result.ok) {
      setSaving(false);
      toast.error(result.reason);
      return;
    }
    // 바뀐 이름이 메뉴와 이 화면에 바로 보이도록 세션을 새로 받는다. 실패해도 저장은 이미 끝났다.
    await browserDb()
      .auth.refreshSession()
      .catch(() => null);
    setSaving(false);
    setDraft(null);
    toast.success(
      result.data.loginIdChanged === true
        ? "저장했습니다. 다음 로그인부터 새 로그인 ID를 사용하세요."
        : "저장했습니다."
    );
  };

  return (
    <Panel>
      <PanelTitle
        title="계정"
        action={
          draft || !account ? null : (
            // 가림 중에 입력 칸을 열면 실제 이름·ID 가 그대로 보인다. 가림을 끈 뒤에만 고치게 한다.
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={masked}
              title={masked ? "마스킹을 끈 뒤 수정할 수 있습니다." : undefined}
              onClick={() => setDraft({ displayName: account.name, loginId: account.loginId })}
            >
              수정
            </Button>
          )
        }
      />
      {draft && masked ? (
        // 고치던 중에 가림을 켜면 입력 칸을 치운다(적던 값은 가림을 끄면 다시 보인다).
        <p className="mt-4 text-sm text-muted-foreground">마스킹을 끈 뒤 수정을 이어서 하세요.</p>
      ) : draft ? (
        <form onSubmit={save} className="mt-4 max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="my-name">이름</Label>
            <Input
              id="my-name"
              value={draft.displayName}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="my-login-id">로그인 ID</Label>
            <Input
              id="my-login-id"
              value={draft.loginId}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setDraft({ ...draft, loginId: event.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2 max-w-md">
          <HhField label="이름" value={account ? mask("name", account.name) : "…"} />
          <HhField label="로그인 ID" value={account ? mask("name", account.loginId) : "…"} />
          {masked ? (
            <p className="mt-2 text-xs text-muted-foreground">마스킹을 끈 뒤 수정할 수 있습니다.</p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

const EMPTY_PASSWORDS = { current: "", next: "", again: "" };

function PasswordPanel() {
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.current || !form.next) {
      toast.error("현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
      return;
    }
    if (form.next.length < PASSWORD_MIN) {
      toast.error(`새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
      return;
    }
    if (form.next !== form.again) {
      toast.error("새 비밀번호와 확인 값이 서로 다릅니다.");
      return;
    }

    setSaving(true);
    const result = await postAccount(
      "/api/account/password",
      { currentPassword: form.current, newPassword: form.next },
      "비밀번호를 바꾸지 못했습니다."
    );
    setSaving(false);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setForm(EMPTY_PASSWORDS);
    toast.success("비밀번호를 바꿨습니다.");
  };

  const field = (key: keyof typeof EMPTY_PASSWORDS, label: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`my-password-${key}`}>{label}</Label>
      <Input
        id={`my-password-${key}`}
        type="password"
        value={form[key]}
        maxLength={PASSWORD_MAX}
        autoComplete={autoComplete}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <Panel>
      <PanelTitle title="비밀번호 변경" />
      <form onSubmit={submit} className="mt-4 max-w-md space-y-4">
        {field("current", "현재 비밀번호", "current-password")}
        {field("next", "새 비밀번호", "new-password")}
        {field("again", "새 비밀번호 확인", "new-password")}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export default function MyPage() {
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    reportEvent("LOGOUT", "로그아웃");
    try {
      await signOutHere();
    } catch {
      setLeaving(false);
      toast.error("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    // 쿠키가 지워진 상태를 서버가 다시 보도록 전체 이동으로 보낸다.
    window.location.assign(LOGIN_PATH);
  };

  return (
    <Screen>
      <HhPageHeader
        title="마이페이지"
        actions={
          <Button type="button" variant="outline" disabled={leaving} onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden="true" />
            로그아웃
          </Button>
        }
      />
      <AccountPanel />
      <PasswordPanel />
    </Screen>
  );
}
