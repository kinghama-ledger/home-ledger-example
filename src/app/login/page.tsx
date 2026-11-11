"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { Lock, User, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_PATH } from "@/lib/routes";

const AFTER_LOGIN = DASHBOARD_PATH;

const WRONG_CREDENTIALS = "로그인 ID 또는 비밀번호가 올바르지 않습니다.";
const CANNOT_CONNECT =
  "로그인 서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

const DEFAULT_MESSAGE: Record<number, string> = {
  400: "로그인 ID와 비밀번호를 확인해 주세요.",
  429: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  500: "로그인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

async function messageFor(response: Response): Promise<string> {
  // 401 은 서버가 무엇을 보냈든 고정 문구만 쓴다(계정이 있는지 없는지 흘리지 않는다).
  if (response.status === 401) return WRONG_CREDENTIALS;
  let fromServer = "";
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      fromServer = data.error;
    }
  } catch {
    // 본문이 JSON 이 아니면 기본 문구로 넘어간다.
  }
  return fromServer || DEFAULT_MESSAGE[response.status] || DEFAULT_MESSAGE[500];
}

// 왼쪽에 작은 그림이 붙은 입력 칸 하나(이름표 + 칸 + 선택 도움말).
type IconFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name" | "onChange"> & {
  id: string;
  label: string;
  icon: LucideIcon;
  help?: string;
  onValue: (next: string) => void;
};

function IconField({ id, label, icon: Icon, help, onValue, ...input }: IconFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          {...input}
          id={id}
          name={id}
          className="pl-9"
          aria-describedby={helpId}
          onChange={(event) => onValue(event.target.value)}
        />
      </div>
      {help ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

// 두 칸의 고정 속성. 화면에 보이는 글자는 여기 한곳에 모아 둔다.
const ID_FIELD = {
  id: "loginId",
  label: "로그인 ID",
  icon: User,
  help: "이메일이 아니라 로그인 ID만 입력하면 됩니다.",
  type: "text",
  placeholder: "로그인 ID",
  autoComplete: "username",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  autoFocus: true,
  required: true,
} as const;

const PASSWORD_FIELD = {
  id: "password",
  label: "비밀번호",
  icon: Lock,
  type: "password",
  placeholder: "비밀번호를 입력해 주세요",
  autoComplete: "current-password",
  required: true,
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem("");

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
    } catch {
      setProblem(CANNOT_CONNECT);
      setBusy(false);
      return;
    }

    if (!response.ok) {
      setProblem(await messageFor(response));
      setBusy(false);
      return;
    }

    // 성공. 버튼은 되살리지 않는다(이동하는 동안 한 번 더 눌리지 않게).
    router.replace(AFTER_LOGIN);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="text-2xl font-bold tracking-tight">우리 집 가계부</p>
          <CardTitle className="text-base">
            <h1>로그인</h1>
          </CardTitle>
          <CardDescription>
            로그인 ID와 비밀번호를 입력해 가계부에 접속하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5">
            <IconField {...ID_FIELD} value={loginId} onValue={setLoginId} />
            <IconField {...PASSWORD_FIELD} value={password} onValue={setPassword} />

            <p className="text-xs text-muted-foreground">
              로그인 상태는 이 브라우저에서 유지됩니다. 공용 PC에서는 사용 후 로그아웃하세요.
            </p>

            {problem ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {problem}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {busy ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
