import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import useWsinfoStore from "@/stores/wsinfo";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (wsinfo._id === null && router.pathname !== '/auth/wsSignin') {
        await router.replace('/auth/wsSignin');
      } else if (staff._id === null && router.pathname !== '/auth/login' && router.pathname !== '/auth/wsSignin') {
        await router.replace('/auth/login');
      } else if (staff._id !== null && (router.pathname === '/auth/login' || router.pathname === '/auth/wsSignin')) {
        await router.replace('/');
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [staff, wsinfo, router]);

  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if ((!wsinfo._id && router.pathname !== '/auth/wsSignin') || (!staff._id && router.pathname !== '/auth/login' && router.pathname !== '/auth/wsSignin')) {
    return null; // Don't render anything if not authenticated and not on login or wsSignin page
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
