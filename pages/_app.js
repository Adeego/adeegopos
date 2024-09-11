import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const router = useRouter();

  useEffect(() => {
    if (staff._id === null && router.pathname !== '/auth/login') {
      router.push('/auth/login');
    } else if (staff._id !== null && router.pathname === '/auth/login') {
      router.push('/');
    }
  }, [staff, router]);

  return (
    <div className="flex">
      <Sidebar />
      <div className="p-4 flex-1 bg-muted/50">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
