"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthActionState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, initial);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" type="text" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            {state.notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {state.notice}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
