"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Natural-language search box. Navigates to /media?q=... so results render as a
 * server component (embeds the query + runs the pgvector RPC on the server).
 */
export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/media?q=${encodeURIComponent(q)}` : "/media");
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search naturally — e.g. “sunset drone footage in Kilifi”"
          className="pl-9"
          aria-label="Search media"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
