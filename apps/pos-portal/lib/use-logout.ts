"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export function useLogout() {
  const router = useRouter();
  return async () => {
    try {
      await api.post("/api/auth/sign-out");
    } catch {
      // Session may already be gone server-side — still clear it locally.
    }
    router.push("/login");
    router.refresh();
  };
}
