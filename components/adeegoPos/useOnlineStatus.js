import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);  // Default to true

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    // Set the initial status
    updateOnlineStatus();

    // Add event listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Clean up event listeners on component unmount
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return isOnline;
}
