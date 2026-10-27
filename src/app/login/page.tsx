import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction } from "./actions";

const input =
  "min-h-10 rounded-lg border border-field bg-surface px-3 text-sm text-ink";

async function LoginForm({ searchParams }: PageProps<"/login">) {
  const failed = (await searchParams).error !== undefined;
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      {failed && <Alert tone="error">Invalid email or password</Alert>}
      <Field label="Email">
        {({ id, describedBy }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            name="email"
            type="email"
            autoComplete="username"
            required
            className={input}
          />
        )}
      </Field>
      <Field label="Password">
        {({ id, describedBy }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={input}
          />
        )}
      </Field>
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </form>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <p className="text-sm font-medium text-muted">Uber 2016 GRC prototype</p>
        <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
        <Suspense fallback={null}>
          <LoginForm {...props} />
        </Suspense>
      </Card>
    </main>
  );
}
