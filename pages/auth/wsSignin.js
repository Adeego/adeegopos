import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';
import { WifiOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function WsSignin() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(false)
  const router = useRouter();
  const [showOfflineDialog, setShowOfflineDialog] = useState(false)
  const addWsinfo = useWsinfoStore((state) => state.addWsinfo);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      setShowOfflineDialog(true)
      return
    }
    // Here you would typically make an API call to verify the workspace info
    try {
      // Here you would typically make an API call to verify the workspace info
      const result = await window.electronAPI.realmOperation('getAllWholeSalers')
      if (result.success && result.wholeSalers.length > 0) {
        addWsinfo(result.wholeSalers[0]) // Store the first wholesaler
        router.push('/')
      } else {
        console.log(result.error || 'Invalid credentials')
      }
    } catch (error) {
      console.error('Error during submission:', error)
    }
  };  

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg">
        <h3 className="text-2xl font-bold text-center">Workspace Sign In</h3>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                type="text"
                id="name"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                type="tel"
                id="phone"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                type="text"
                id="location"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">Sign In</Button>
          </div>
        </form>
      </div>
      <Dialog open={showOfflineDialog} onOpenChange={setShowOfflineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You're Offline</DialogTitle>
            <DialogDescription>
              <div className="flex items-center space-x-2">
                <WifiOffIcon className="text-red-500" />
                <span>Please check your internet connection and try again.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowOfflineDialog(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
