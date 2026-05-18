import "@/styles/globals.css";
import Sidebar from "@/components/sidebar";
import useStaffStore from "@/stores/staffStore";
import useWsinfoStore from "@/stores/wsinfo";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { Wifi, WifiOff, ArrowLeft, Bell, Menu, Bot } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button"
import ProfileDialog from "@/components/staff/profileDialog";
import { MessageDialog } from "@/components/wholesalerComps/messages";
import { ReminderDialog } from "@/components/reminders/ReminderDialog";
import { manageRestock } from "@/components/stockManagement/stockManager";
import Image from 'next/image';
import posLogo from '@/assets/pos.png';
import ChatPanel from '@/components/aiAssistant/ChatPanel';
import { can, canAccessRoute, getDefaultRoute, getRoleLabels, normalizeStaff } from "@/lib/rbac";

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
  const [isSubscriptionValid, setIsSubscriptionValid] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const normalizedStaff = useMemo(() => normalizeStaff(staff), [staff]);
  const showAiButton = staff._id && can(normalizedStaff, 'assistant:use');
  const [accessDeniedPath, setAccessDeniedPath] = useState('');

  useEffect(() => {
    let removeRestockListener;
    let removeReportListener;

    if (can(normalizedStaff, 'stock:manage') && isStaffLoaded) {
      if (wsinfo && wsinfo.storeNo) {
        manageRestock(wsinfo.storeNo);
        
        // Start the restock scheduler for morning/evening calculations
        if (typeof window !== "undefined" && window.electronAPI) {
          window.electronAPI.restock('startScheduler', wsinfo.storeNo)
            .then(result => {
              console.log('[RestockScheduler] Started:', result);
            })
            .catch(err => {
              console.error('[RestockScheduler] Failed to start:', err);
            });
        }
      }
    }
    
    if (typeof window !== "undefined" && window.electronAPI) {
      removeRestockListener = window.electronAPI.onRestockTriggered((productData) => {
        if (can(normalizedStaff, 'stock:manage')) {
          console.log('Restock triggered for product:', productData);
          if (wsinfo && wsinfo.storeNo) {
            manageRestock(wsinfo.storeNo);
          }
        }
      });

      removeReportListener = window.electronAPI.onRestockReportGenerated((data) => {
        if (can(normalizedStaff, 'stock:manage')) {
          console.log(`[RestockScheduler] ${data.scheduleType} report generated for ${data.productCount} products`);
        }
      });
    }

    return () => {
      if (removeRestockListener) {
        removeRestockListener();
      }
      if (removeReportListener) {
        removeReportListener();
      }
    };
  }, [staff, normalizedStaff, isStaffLoaded, wsinfo])

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.setAuthenticatedStaff && isStaffLoaded) {
      window.electronAPI.setAuthenticatedStaff(staff._id ? normalizedStaff : null).catch((error) => {
        console.error('Failed to sync staff auth context:', error);
      });
    }
  }, [staff, normalizedStaff, isStaffLoaded]);

  // useEffect(() => {
  //   createDefaultCustomer();
  // }, [wsinfo, isWsinfoLoaded])

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

      // Ensure splash screen is shown for at least 2 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));

      // First, check workspace signin
      if (wsinfo._id === null && router.pathname !== "/auth/wsSignin") {
        await router.replace("/auth/wsSignin");
        return;
      }

    // If workspace is signed in, handle staff authentication and subscription
      if (wsinfo._id !== null) {
        // If not on a public path and no staff is logged in, redirect to login
        if (staff._id === null && !isPublicPath) {
          await router.replace("/auth/login");
          return;
        }

        // If staff is logged in and trying to access public paths, redirect to home
        if (staff._id !== null && isPublicPath) {
          await router.replace(getDefaultRoute(normalizedStaff));
          return;
      }

        if (staff._id !== null && !isPublicPath && !canAccessRoute(normalizedStaff, router.pathname)) {
          setAccessDeniedPath(router.pathname);
          setIsLoading(false);
          return;
        }
    }

      setAccessDeniedPath('');
      setIsLoading(false);
    };

    if (isStaffLoaded && isWsinfoLoaded) {
      checkAuth();
    }
  }, [staff, normalizedStaff, wsinfo, router, isStaffLoaded, isWsinfoLoaded]);

  const findDefaultCustomer = async (phoneNumber) => {
    try {
      const result = await window.electronAPI.searchCustomers(phoneNumber, wsinfo.storeNo);
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

  // const createDefaultCustomer = async () => {
  //   const storeNo = wsinfo.storeNo;
    
  //   // First, check if a default customer already exists
  //   const existingCustomer = await findDefaultCustomer(storeNo);
    
  //   // If customer exists, do nothing
  //   if (existingCustomer) {
  //     console.log('Default customer already exists');
  //     return existingCustomer;
  //   }

  //   // If no existing customer, create a new one
  //   const newCustomerData = {
  //     ...newCustomer,
  //     _id: `${storeNo}:${uuidv4()}`,
  //     phoneNumber: `${storeNo}`,
  //     balance: 0,
  //     storeNo: `${storeNo}`
  //   };

  //   console.log(newCustomerData);

  //   try {
  //     const result = await window.electronAPI.realmOperation('createCustomer', newCustomerData);
  //     if (result.success) {
  //       setNewCustomer({ name: '', phoneNumber: '', address: '' });
  //       return result.customer;
  //     } else {
  //       console.error('Failed to create customer:', result.error);
  //       return null;
  //     }
  //   } catch (error) {
  //     console.error('Error creating customer:', error);
  //     return null;
  //   }
  // }

  const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <Image 
        src={posLogo} 
        alt="POS Logo" 
        width={200} 
        height={200} 
        className="animate-pulse rounded-3xl"
      />
    </div>
  );
};

  const AccessDenied = () => (
    <div className="min-h-[calc(100vh-90px)] flex items-center justify-center">
      <div className="max-w-md rounded-md border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your current roles ({getRoleLabels(normalizedStaff).join(', ') || 'none'}) do not allow this page.
        </p>
        <Button className="mt-4" onClick={() => router.replace(getDefaultRoute(normalizedStaff))}>
          Go to my workspace
        </Button>
      </div>
    </div>
  );

if (!isStaffLoaded || !isWsinfoLoaded || isLoading) {
  return <SplashScreen />; 
}

  return (
    <div className="flex">
      {wsinfo._id && staff._id && isSubscriptionValid && <Sidebar />}
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
              <ReminderDialog />
              <ProfileDialog />
              {can(normalizedStaff, 'message:read') && <MessageDialog />}
            </div>
          </header>
        }
        
        {accessDeniedPath ? <AccessDenied /> : <Component {...pageProps} />}
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

      {showAiButton && (
        <>
          <ChatPanel open={isChatOpen} onClose={() => setIsChatOpen(false)} />
          {!isChatOpen && (
            <button
              onClick={() => setIsChatOpen(true)}
              className="fixed bottom-14 right-4 z-50 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              title="Adeego AI Assistant"
            >
              <Bot className="h-6 w-6" />
            </button>
          )}
        </>
      )}

    </div>
  );
}
