import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, useLogin } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("Password123");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await loginMutation.mutateAsync({ email, password });
      navigate("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("登录失败，请稍后再试。");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h1 className="mb-5 text-center text-2xl font-semibold">登录平台</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            记住我
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-white disabled:opacity-50"
          >
            {loginMutation.isPending ? "登录中..." : "登录"}
          </button>

          <p className="text-center text-sm text-foreground/70">
            还没有账号？
            <Link to="/register" className="ml-1 text-primary underline">
              去注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
