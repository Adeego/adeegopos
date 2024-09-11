import React, { useState, useEffect } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';

export default function Logout() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const deleteWsinfo = useWsinfoStore((state) => state.deleteWsinfo);

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleLogout = () => {
    deleteWsinfo();
    router.push('/auth/login');
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be logged out of your account and redirected to the login page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel><Link href={'/'}>Cancel</Link></AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout}>Log Out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
