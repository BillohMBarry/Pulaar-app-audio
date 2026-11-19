import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Sign In",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : "/admin";

  return <AdminLoginForm nextPath={nextPath} />;
}

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-sm rounded-xl" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Back to Pular Vocabulary
      </Link>
    </main>
  );
}
