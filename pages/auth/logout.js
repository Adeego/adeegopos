import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LogOut, Store } from "lucide-react"
import { useRouter } from 'next/router';
import useStaffStore from "@/stores/staffStore"

export default function Logout() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter();
  const deleteStaff = useStaffStore((state) => state.deleteStaff);

  const handleLogout = () => {
    setIsLoggingOut(true)
    deleteStaff();
    router.push('/auth/login');

    setTimeout(() => {
        setIsLoggingOut(false)
        setIsDialogOpen(false)
        // In a real application, you would redirect to the login page or perform other logout actions here
      }, 2000)
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center">
            <Store className="mr-2" />
            POS System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-600 mb-6">
            Thank you for using our POS system. Are you sure you want to log out?
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => setIsDialogOpen(true)} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? This will end your current session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoggingOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Logging out..." : "Confirm Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// export default function Component() {
//   const [isDialogOpen, setIsDialogOpen] = useState(false)
//   const [isLoggingOut, setIsLoggingOut] = useState(false)

//   const handleLogout = () => {
    
//     // Simulate logout process
    
//   }

//   return (
//     <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
//       <Card className="w-full max-w-md">
//         <CardHeader>
//           <CardTitle className="text-2xl font-bold text-center flex items-center justify-center">
//             <Store className="mr-2" />
//             POS System
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <p className="text-center text-gray-600 mb-6">
//             Thank you for using our POS system. Are you sure you want to log out?
//           </p>
//         </CardContent>
//         <CardFooter className="flex justify-center">
//           <Button onClick={() => setIsDialogOpen(true)} className="w-full">
//             <LogOut className="mr-2 h-4 w-4" /> Log Out
//           </Button>
//         </CardFooter>
//       </Card>

//       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Confirm Logout</DialogTitle>
//             <DialogDescription>
//               Are you sure you want to log out? This will end your current session.
//             </DialogDescription>
//           </DialogHeader>
//           <DialogFooter className="sm:justify-between">
//             <Button
//               type="button"
//               variant="secondary"
//               onClick={() => setIsDialogOpen(false)}
//               disabled={isLoggingOut}
//             >
//               Cancel
//             </Button>
//             <Button
//               type="button"
//               variant="destructive"
//               onClick={handleLogout}
//               disabled={isLoggingOut}
//             >
//               {isLoggingOut ? "Logging out..." : "Confirm Logout"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// }