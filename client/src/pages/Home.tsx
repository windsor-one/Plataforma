import AuthGate from "@/components/AuthGate";
import Dashboard from "@/components/Dashboard";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  return <AuthGate>{(user, profile) => <Dashboard user={user} profile={profile} />}</AuthGate>;
}
