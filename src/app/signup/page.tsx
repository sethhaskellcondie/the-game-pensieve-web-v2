import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up · The Game Pensieve",
};

export default function SignupPage() {
  return (
    <main>
      <SignupForm />
    </main>
  );
}
