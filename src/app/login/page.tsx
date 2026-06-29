import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in · The Game Pensieve",
};

export default function LoginPage() {
  return (
    <main>
      <LoginForm />
    </main>
  );
}
