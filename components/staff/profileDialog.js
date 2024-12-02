"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useStaffStore from "@/stores/staffStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { UserCircle, LogOut, Phone, Lock, User, Briefcase } from "lucide-react"

export default function ProfileDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const staff = useStaffStore((state) => state.staff)
  const updateStaff = useStaffStore((state) => state.updateStaff)
  const deleteStaff = useStaffStore((state) => state.deleteStaff)

  const [formData, setFormData] = useState({
    phone: staff.phone || "",
    passcode: "",
    confirmPasscode: "",
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleUpdate = async () => {
    if (formData.passcode !== formData.confirmPasscode) {
      toast({
        description: "Passcodes do not match",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      const updateData = {
        ...staff,
        phone: formData.phone,
        ...(formData.passcode && { passcode: formData.passcode }),
        updatedAt: new Date().toISOString(),
      }

      const result = await window.electronAPI.realmOperation(
        "updateStaff",
        updateData
      )

      if (result.success) {
        updateStaff(updateData)
        toast({
          description: "Profile updated successfully",
        })
        setIsOpen(false)
      } else {
        toast({
          description: "Failed to update profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        description: "Error updating profile",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = () => {
    deleteStaff()
    router.push("/auth/login")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <UserCircle className="h-5 w-5" />
          <span className="sr-only">Profile</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Profile Settings</DialogTitle>
          <DialogDescription>
            View and update your profile information
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={staff.avatarUrl} alt={`${staff.firstName} ${staff.lastName}`} />
              <AvatarFallback>{staff.firstName[0]}{staff.lastName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{staff.firstName} {staff.lastName}</h3>
              <p className="text-sm text-muted-foreground">{staff.role}</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="pl-10"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="passcode" className="text-sm font-medium">New Passcode</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="passcode"
                  name="passcode"
                  type="password"
                  value={formData.passcode}
                  onChange={handleInputChange}
                  className="pl-10"
                  placeholder="Enter new passcode"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPasscode" className="text-sm font-medium">Confirm New Passcode</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPasscode"
                  name="confirmPasscode"
                  type="password"
                  value={formData.confirmPasscode}
                  onChange={handleInputChange}
                  className="pl-10"
                  placeholder="Confirm new passcode"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="mt-3 sm:mt-0"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
          <Button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}