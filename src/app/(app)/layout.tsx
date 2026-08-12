import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders alongside middleware: never render the app shell
  // for an unauthenticated request.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="text-sm text-muted-foreground">{user.email}</div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="ghost" size="icon" aria-label="Sign out" type="submit">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
