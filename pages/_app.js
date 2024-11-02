import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import useWsinfoStore from "@/stores/wsinfo";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { Wifi, WifiOff, ArrowLeft, Bell, Menu } from "lucide-react";
import AutoUpdater from "@/components/AutoUpdater";
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [isWsinfoLoaded, setIsWsinfoLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const storeNo = wsinfo.storeNo;
    if (storeNo) {
      // Send `storeNo` to Electron's main process
      window.electronAPI.send("send-storeNo", storeNo);
    }
  }, [wsinfo.storeNo]);

  useEffect(() => {
    let removeListener;
  
    if (typeof window !== "undefined" && window.electronAPI) {
      removeListener = window.electronAPI.onOnlineStatusChanged((status) => {
        setIsOnline(status);
      });
    }
  
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
      console.log(wsinfo);
    }
  }, [wsinfo]);

  useEffect(() => {
    const checkAuth = async () => {
      if (wsinfo._id === null && router.pathname !== "/auth/wsSignin") {
        await router.replace("/auth/wsSignin");
      } else if (
        wsinfo._id !== null &&
        (router.pathname === "/auth/login" ||
          router.pathname === "/auth/wsSignin")
      ) {
        if (
          staff._id === null &&
          router.pathname !== "/auth/login" &&
          router.pathname !== "/auth/wsSignin"
        ) {
          await router.replace("/auth/login");
        } else if (
          staff._id !== null &&
          (router.pathname === "/auth/login" ||
            router.pathname === "/auth/wsSignin")
        ) {
          await router.replace("/");
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

  return (
    <div className="flex">
      {wsinfo._id && <Sidebar />}
      <div className="p-4 flex-1 bg-muted/50">
        <header className="flex items-center justify-between px-4 h-[50px] bg-white/80 backdrop-blur-sm z-40 mb-2 rounded-md border ">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Go back</span>
            </Button>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
          </div>
        </header>
        <Component {...pageProps} />
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        {isOnline ? (
          <Badge variant="secondary" className="bg-white/10 backdrop-blur-sm scale-80 p-0">
            <Wifi size={14} />
            <p className="ml-1 text-sm">Online</p>
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-white/10 backdrop-blur-sm scale-80 p-0">
            <WifiOff size={14} />
            <p className="ml-1 text-sm">Offline</p>
          </Badge>
        )}
      </div>

      <Toaster />

    </div>
  );
}
