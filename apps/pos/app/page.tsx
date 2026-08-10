import { redirect } from 'next/navigation';

// The POS root always redirects to the PIN login screen
export default function POSHome() {
  redirect('/login');
}
