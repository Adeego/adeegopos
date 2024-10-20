import "../styles/globals.css";
import Sidebar from "../components/sidebar";
import useStaffStore from "../stores/staffStore";
import useWsinfoStore from "../stores/wsinfo";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Badge } from "../components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (wsinfo._id === null && router.pathname !== "/auth/wsSignin") {
        await router.push("/auth/wsSignin");
      } 
      // else if (staff._id === null && 
      //            router.pathname !== "/auth/login" && 
      //            router.pathname !== "/auth/wsSignin") {
      //   await router.push("/auth/login");
      // }
      setIsLoading(false);
    };

    checkAuth();
  }, [wsinfo, router]);

  useEffect(() => {
    // Here you would typically check online status
    setIsOnline(true);
  }, []);

  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  return (
    <div className="flex">
      {wsinfo._id && <Sidebar />}
      <div className="p-4 flex-1 bg-muted/50">
        <Component {...pageProps} />
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        {isOnline ? (
          <Badge className="border-solid border-2 border-neutral-800" variant="secondary">
            <Wifi size={16} />
            <p className="ml-1">Online</p>
          </Badge>
        ) : (
          <Badge className="border-solid border-2 border-neutral-800" variant="secondary">
            <WifiOff size={16} />
            <p className="ml-1">Offline</p>
          </Badge>
        )}
      </div>
    </div>
  );
}
