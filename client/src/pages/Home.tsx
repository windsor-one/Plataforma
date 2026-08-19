import AuthGate from "@/components/AuthGate";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <AuthGate>{(user, profile) => <Dashboard user={user} profile={profile} />}</AuthGate>;
}
