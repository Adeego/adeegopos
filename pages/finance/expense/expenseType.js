import React, { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/components/ui/use-toast"
import useWsinfoStore from '@/stores/wsinfo';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2 } from 'lucide-react'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"

export default function ExpenseType() {
  const { toast } = useToast()
  const [expenseTypes, setExpenseTypes] = useState([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newExpenseType, setNewExpenseType] = useState({
    name: '',
    description: ''
  })
  const [currentExpenseType, setCurrentExpenseType] = useState({
    _id: null,
    name: '',
    description: '',
    storeNo: ''
  })
  const [storeNo, setStoreNo] = useState("");
  const store = useWsinfoStore((state) => state.wsinfo);

  useEffect(() => {
    if (store.storeNo) {
      setStoreNo(store.storeNo)
    }
    fetchExpenseTypes();
  }, [store.storeNo]);

  const fetchExpenseTypes = async () => {
    try {
      const result = await window.electronAPI.realmOperation('getAllExpenseTypes');
      if (result.success) {
        setExpenseTypes(result.expenseTypes || [])
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch expense types",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching expense types",
        variant: "destructive"
      })
    }
  }

  const validateInput = (name, description) => {
    if (!name || name.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Expense type name cannot be empty",
        variant: "destructive"
      })
      return false
    }
    if (!description || description.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Description cannot be empty",
        variant: "destructive"
      })
      return false
    }
    return true
  }

  const handleAddExpenseType = async () => {
    if (!validateInput(newExpenseType.name, newExpenseType.description)) return

    const newType = {
      _id: `${storeNo}:${uuidv4()}`,
      name: newExpenseType.name.trim(),
      description: newExpenseType.description.trim(),
      storeNo: storeNo
    }

    try {
      const result = await window.electronAPI.realmOperation('createExpenseType', newType);
      if (result.success) {
        toast({
          title: "Success",
          description: "Expense type added successfully",
        })
        setNewExpenseType({ name: '', description: '' })
        setAddDialogOpen(false)
        fetchExpenseTypes();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add expense type",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding expense type",
        variant: "destructive"
      })
    }
  }

  const handleEditExpenseType = async () => {
    if (!validateInput(currentExpenseType.name, currentExpenseType.description)) return

    const updatedType = {
      _id: currentExpenseType._id,
      name: currentExpenseType.name.trim(),
      description: currentExpenseType.description.trim(),
      storeNo: storeNo
    }

    try {
      const result = await window.electronAPI.realmOperation('updateExpenseType', updatedType)
      if (result.success) {
        toast({
          title: "Success",
          description: "Expense type updated successfully",
        })
        fetchExpenseTypes();
        setEditDialogOpen(false)
      } else {
        console.log(result.error);
        toast({
          title: "Error",
          description: result.error || "Failed to update expense type",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating expense type",
        variant: "destructive"
      })
    }
  }

  const handleDeleteExpenseType = async (id) => {
    try {
      const result = await window.electronAPI.realmOperation('archiveExpenseType', id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Expense type deleted successfully",
        })
        setDeleteDialogOpen(false)
        fetchExpenseTypes();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete expense type",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting expense type",
        variant: "destructive"
      })
    }
  }

  const openEditDialog = (type) => {
    setCurrentExpenseType({
      _id: type._id,
      name: type.name,
      description: type.description,
      storeNo: type.storeNo
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (type) => {
    setCurrentExpenseType(type)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Expense Types</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Expense Type</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Expense Type</DialogTitle>
              <DialogDescription >Add a new expense type</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input 
                  id="name" 
                  value={newExpenseType.name}
                  onChange={(e) => setNewExpenseType({
                    ...newExpenseType, 
                    name: e.target.value
                  })}
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input 
                  id="description" 
                  value={newExpenseType.description}
                  onChange={(e) => setNewExpenseType({
                    ...newExpenseType, 
                    description: e.target.value
                  })}
                  className="col-span-3" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddExpenseType}>
                Add Expense Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense Type</DialogTitle>
            <DialogDescription>Update the details below</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input 
                id="edit-name" 
                value={currentExpenseType.name}
                onChange={(e) => setCurrentExpenseType({
                  ...currentExpenseType, 
                  name: e.target.value
                })}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                Description
              </Label>
              <Input 
                id="edit-description" 
                value={currentExpenseType.description}
                onChange={(e) => setCurrentExpenseType({
                  ...currentExpenseType, 
                  description: e.target.value
                })}
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditExpenseType}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableCaption>A list of expense types</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenseTypes.map((type) => (
            <TableRow key={type._id}>
              <TableCell>{type.name}</TableCell>
              <TableCell>{type.description}</TableCell>
              <TableCell>{type.createdAt || 'N/A'}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => openEditDialog(type)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="icon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the expense type "{type.name}".
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteExpenseType(type._id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
