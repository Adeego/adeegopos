import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import useWsinfoStore from "@/stores/wsinfo";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { Wifi, WifiOff, ArrowLeft, Bell, Menu } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button"
import ProfileDialog from "@/components/staff/profileDialog";

export default function App({ Component, pageProps }) {
  const staff = useStaffStore((state) => state.staff);
  const wsinfo = useWsinfoStore((state) => state.wsinfo);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [isWsinfoLoaded, setIsWsinfoLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    _id: '',
    name: 'GUEST CLIENT',
    phoneNumber: '',
    address: 'N/A',
    balance: '',
    credit: false,
    status: 'NEUTRAL',
    storeNo: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    createDefaultCustomer();
  }, [wsinfo, isWsinfoLoaded])

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
      const publicPaths = ['/auth/login', '/auth/wsSignin', '/auth/register'];
      const isPublicPath = publicPaths.includes(router.pathname);

      // First, check workspace signin
      if (wsinfo._id === null && router.pathname !== "/auth/wsSignin") {
        await router.replace("/auth/wsSignin");
        return;
      }

      // If workspace is signed in, handle staff authentication
      if (wsinfo._id !== null) {
        // If not on a public path and no staff is logged in, redirect to login
        if (staff._id === null && !isPublicPath) {
          await router.replace("/auth/login");
          return;
        }

        // If staff is logged in and trying to access login/wsSignin, redirect to home
        if (staff._id !== null && isPublicPath) {
          await router.replace("/");
          return;
        }
      }

      setIsLoading(false);
    };

    if (isStaffLoaded && isWsinfoLoaded) {
      checkAuth();
    }
  }, [staff, wsinfo, router, isStaffLoaded, isWsinfoLoaded]);

  const findDefaultCustomer = async (phoneNumber) => {
    try {
      const result = await window.electronAPI.searchCustomers(phoneNumber);
      if (result.success && result.customers.length > 0) {
        console.log(result.customers);
        return result.customers[0];
      }
      return null;
    } catch (error) {
      console.error('Error searching for customer:', error);
      return null;
    }
  };

  const createDefaultCustomer = async () => {
    const storeNo = wsinfo.storeNo;
    
    // First, check if a default customer already exists
    const existingCustomer = await findDefaultCustomer(storeNo);
    
    // If customer exists, do nothing
    if (existingCustomer) {
      console.log('Default customer already exists');
      return existingCustomer;
    }

    // If no existing customer, create a new one
    const newCustomerData = {
      ...newCustomer,
      _id: `${storeNo}:${uuidv4()}`,
      phoneNumber: `${storeNo}`,
      balance: 0,
      storeNo: `${storeNo}`
    };

    console.log(newCustomerData);

    try {
      const result = await window.electronAPI.realmOperation('createCustomer', newCustomerData);
      if (result.success) {
        setNewCustomer({ name: '', phoneNumber: '', address: '' });
        return result.customer;
      } else {
        console.error('Failed to create customer:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      return null;
    }
  }

  if (!isStaffLoaded || !isWsinfoLoaded || isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  return (
    <div className="flex">
      {wsinfo._id && staff._id && <Sidebar />}
      <div className="p-4 flex-1 bg-muted/50">
        {
          wsinfo._id && staff._id && 
          <header className="flex items-center justify-between px-4 h-[50px] bg-white/80 backdrop-blur-sm z-40 mb-2 rounded-md border ">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Go back</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <ProfileDialog />
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
            </div>
          </header>
        }
        
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
