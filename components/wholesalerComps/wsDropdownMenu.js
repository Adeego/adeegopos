"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/router';
import useWsinfoStore from '@/stores/wsinfo';
import useStaffStore from '@/stores/staffStore';
import { Button } from "@/components/ui/button"
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function WsDropdownMenu({ isSideBarEnlarged, icon }) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const deleteWsinfo = useWsinfoStore(state => state.deleteWsinfo);
  const deleteStaff = useStaffStore(state => state.deleteStaff)
  const router = useRouter()

  const handleLogout = () => {
    // Call the deleteWsinfo function to clear the wsinfo data
    deleteWsinfo();
    deleteStaff();
    // Add your actual logout logic here
    setIsLogoutDialogOpen(false);
    router.push('/auth/wsSignin')
  }  

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={`${
            isSideBarEnlarged ? "" : "max-w-fit w-10 lg:!w-12"
          } !cursor-pointer rounded-[0.4rem] flex flex-row items-center w-full hover:bg-neutral-200/50`}>
            <div className="rounded-[0.3rem] overflow-hidden h-9 aspect-square shrink-0 flex items-center justify-center">
              {icon}
            </div>
            {isSideBarEnlarged && (
              <p className="text-sm text-neutral-500 hidden lg:block">Settings</p>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link className='flex flex-1' href={'/adeegoPos/subscription'} >Subscription</Link>
              {/* <DropdownMenuShortcut>⌘S</DropdownMenuShortcut> */}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link className='flex flex-1' href={'/adeegoPos/support'} >
                Support
              </Link>
              {/* <DropdownMenuShortcut>⌘H</DropdownMenuShortcut> */}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsLogoutDialogOpen(true)}>
              Logout
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog modal={false} open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to log in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}