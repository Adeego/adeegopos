import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import useWsinfoStore from "@/stores/wsinfo";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useOnlineStatus } from "@/components/adeegoPos/useOnlineStatus";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [isWsinfoLoaded, setIsWsinfoLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let removeListener; // Track the listener so that it can be removed
  
    if (typeof window !== "undefined" && window.electronAPI) {
      // Initial check
      window.electronAPI.getOnlineStatus().then((status) => {
        // console.log("Initial online status:", status);
        setIsOnline(status);
      });
  
      // Listen for changes
      removeListener = window.electronAPI.onOnlineStatusChanged((status) => {
        // console.log("Online status changed:", status);
        setIsOnline(status);
      });
    }
  
    // Cleanup: Unsubscribe from the listener when the component is unmounted
    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, []);

  useEffect(() => {
    if (staff._id !== undefined) {
      setIsStaffLoaded(true);
    }
  }, [staff]);

  useEffect(() => {
    if (wsinfo._id !== undefined) {
      setIsWsinfoLoaded(true);
      console.log(wsinfo)
    }
  }, [wsinfo]);

  useEffect(() => {
    const checkAuth = async () => {
      if (wsinfo._id === null && router.pathname !== '/auth/wsSignin') {
        await router.replace('/auth/wsSignin');
      } else if (wsinfo._id !== null && (router.pathname === '/auth/login' || router.pathname === '/auth/wsSignin')) {
        if (staff._id === null && router.pathname !== '/auth/login' && router.pathname !== '/auth/wsSignin') {
          await router.replace('/auth/login');
        } else if (staff._id !== null && (router.pathname === '/auth/login' || router.pathname === '/auth/wsSignin')) {
          await router.replace('/');
        }
      }
      setIsLoading(false);
    };

    if (isStaffLoaded && isWsinfoLoaded) {
      checkAuth();
    }
  }, [staff, wsinfo, router, isStaffLoaded, isWsinfoLoaded]);

  if (!isStaffLoaded || !isWsinfoLoaded || isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if ((!wsinfo._id && router.pathname !== '/auth/wsSignin') || (!staff._id && router.pathname !== '/auth/login' && router.pathname !== '/auth/wsSignin')) {
    return null; // Don't render anything if not authenticated and not on login or wsSignin page
  }

  return (
    <div className="flex">
      {staff._id && wsinfo._id && <Sidebar />}
      <div className="p-4 flex-1 bg-muted/50">
        <Component {...pageProps} />
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        {isOnline ? (
          <Badge variant="secondary">
            <Wifi size={16} /><p className="ml-1">Online</p>
          </Badge>
        ) : (
          <Badge variant="secondary">
            <WifiOff size={16} /><p className="ml-1">Offline</p>
          </Badge>
        )}
      </div>
    </div>
  );
}
