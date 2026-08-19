import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/features/auth/ResetPasswordForm";

export default function ResetPasswordRoute() {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-white px-6 py-12">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
