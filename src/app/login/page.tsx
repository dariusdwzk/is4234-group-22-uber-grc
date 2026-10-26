import { Suspense } from "react";
import { loginAction } from "./actions";

async function LoginForm({ searchParams }: PageProps<"/login">) {
  const failed = (await searchParams).error !== undefined;
  return (
    <form action={loginAction} className="flex max-w-sm flex-col gap-3">
      {failed && <p role="alert">Invalid email or password</p>}
      <label className="flex flex-col gap-1">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border px-2 py-1"
        />
      </label>
      <button type="submit" className="border px-3 py-1">
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={null}>
        <LoginForm {...props} />
      </Suspense>
    </main>
  );
}
