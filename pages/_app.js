import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
    if (staff._id === null && router.pathname !== '/auth/login') {
        await router.replace('/auth/login');
    } else if (staff._id !== null && router.pathname === '/auth/login') {
        await router.replace('/');
    }
      setIsLoading(false);
    };

    checkAuth();
  }, [staff, router]);

  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if (!staff._id && router.pathname !== '/auth/login') {
    return null; // Don't render anything if not authenticated and not on login page
  }

  return (
    <div className="flex">
      {staff._id && <Sidebar />}
      <div className="p-4 flex-1 bg-muted/50">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
