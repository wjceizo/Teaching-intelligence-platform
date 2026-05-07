import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, useRegister } from "../lib/api";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAllFields = Boolean(
    username.trim() && email.trim() && password.trim() && confirmPassword.trim()
  );
  const passwordValid = PASSWORD_RULE.test(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    hasAllFields && passwordValid && passwordsMatch && !registerMutation.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!hasAllFields) {
      setError("请完整填写用户名、邮箱、密码和确认密码。");
      return;
    }

    if (!passwordValid) {
      setError("密码至少8位，且必须包含字母和数字。");
      return;
    }

    if (!passwordsMatch) {
      setError("两次输入的密码不一致");
      return;
    }

    try {
      await registerMutation.mutateAsync({ username, email, password });
      navigate("/login");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("注册失败，请稍后再试。");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-100 via-cyan-50 to-sky-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h1 className="mb-5 text-center text-2xl font-semibold">注册账号</h1>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm">
              用户名
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm">
                密码
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs text-foreground/70 underline"
              >
                {showPassword ? "隐藏" : "显示"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
            <p className="mt-1 text-xs text-foreground/70">密码至少8位，且必须包含字母和数字。</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="confirmPassword" className="block text-sm">
                确认密码
              </label>
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="text-xs text-foreground/70 underline"
              >
                {showConfirmPassword ? "隐藏" : "显示"}
              </button>
            </div>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md border border-black bg-white px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            {registerMutation.isPending ? "注册中..." : "注册"}
          </button>

          <p className="text-center text-sm text-foreground/70">
            已有账号？
            <Link to="/login" className="ml-1 text-primary underline">
              去登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
