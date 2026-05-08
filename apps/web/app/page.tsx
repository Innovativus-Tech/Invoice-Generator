import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect the root path to the dashboard. 
  // If the user is unauthenticated, the dashboard layout/middleware will handle redirecting to /login.
  redirect('/dashboard');
}
