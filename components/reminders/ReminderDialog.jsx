"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { AlarmClock, Check, Clock3, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import useStaffStore from "@/stores/staffStore"
import useWsinfoStore from "@/stores/wsinfo"

const emptyForm = {
  title: "",
  notes: "",
  dueAt: "",
}

function toDateTimeInputValue(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeInputValue(value) {
  if (!value) return ""

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function formatDateTime(value) {
  if (!value) return "No time set"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Invalid time"

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getEffectiveDueAt(reminder) {
  return reminder?.snoozedUntil || reminder?.dueAt || ""
}

function isDue(reminder, now = Date.now()) {
  if (!reminder || reminder.status !== "active") return false

  const dueAt = new Date(getEffectiveDueAt(reminder)).getTime()
  return Number.isFinite(dueAt) && dueAt <= now
}

function sortByEffectiveDue(a, b) {
  return new Date(getEffectiveDueAt(a)).getTime() - new Date(getEffectiveDueAt(b)).getTime()
}

function getTomorrowMorningIso() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow.toISOString()
}

function getDefaultDueAt() {
  const date = new Date()
  date.setMinutes(date.getMinutes() + 30)
  date.setSeconds(0, 0)
  return toDateTimeInputValue(date.toISOString())
}

export function ReminderDialog() {
  const staff = useStaffStore((state) => state.staff)
  const store = useWsinfoStore((state) => state.wsinfo)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reminders, setReminders] = useState([])
  const [form, setForm] = useState({ ...emptyForm, dueAt: getDefaultDueAt() })
  const [editingReminder, setEditingReminder] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const alertedReminderKeys = useRef(new Set())

  const storeNo = store?.storeNo || ""
  const staffId = staff?._id || ""
  const canUseReminders = Boolean(storeNo && staffId)

  const fetchReminders = useCallback(async ({ quiet = false } = {}) => {
    if (!canUseReminders || typeof window === "undefined" || !window.electronAPI) return

    if (!quiet) setIsLoading(true)

    try {
      const result = await window.electronAPI.realmOperation("getMyReminders", { storeNo, staffId })
      if (result.success) {
        setReminders(result.reminders || [])
      } else if (!quiet) {
        toast({
          title: "Could not load reminders",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      if (!quiet) {
        toast({
          title: "Could not load reminders",
          description: error.message,
          variant: "destructive",
        })
      }
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }, [canUseReminders, staffId, storeNo, toast])

  useEffect(() => {
    if (!canUseReminders) return

    fetchReminders()
    const interval = setInterval(() => {
      fetchReminders({ quiet: true })
    }, 60000)

    return () => clearInterval(interval)
  }, [canUseReminders, fetchReminders])

  useEffect(() => {
    const dueReminders = reminders.filter((reminder) => isDue(reminder))

    dueReminders.forEach((reminder) => {
      const alertKey = `${reminder._id}:${getEffectiveDueAt(reminder)}`
      if (alertedReminderKeys.current.has(alertKey)) return

      alertedReminderKeys.current.add(alertKey)

      toast({
        title: "Reminder due",
        description: reminder.title,
      })

      const audio = new Audio("/assets/alertSound/alert.wav")
      audio.play().catch((error) => console.error("Error playing reminder sound:", error))
    })
  }, [reminders, toast])

  const activeReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status === "active").sort(sortByEffectiveDue),
    [reminders]
  )

  const completedReminders = useMemo(
    () => reminders
      .filter((reminder) => reminder.status === "done")
      .sort((a, b) => new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime()),
    [reminders]
  )

  const dueCount = useMemo(
    () => activeReminders.filter((reminder) => isDue(reminder)).length,
    [activeReminders]
  )

  const resetForm = () => {
    setEditingReminder(null)
    setForm({ ...emptyForm, dueAt: getDefaultDueAt() })
  }

  const handleEdit = (reminder) => {
    setEditingReminder(reminder)
    setForm({
      title: reminder.title || "",
      notes: reminder.notes || "",
      dueAt: toDateTimeInputValue(reminder.dueAt),
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.title.trim()) {
      toast({
        title: "Title required",
        description: "Add a short reminder title.",
        variant: "destructive",
      })
      return
    }

    const dueAt = fromDateTimeInputValue(form.dueAt)
    if (!dueAt) {
      toast({
        title: "Time required",
        description: "Choose when this reminder should alert you.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    const payload = {
      _id: editingReminder?._id || `${storeNo}:reminder:${uuidv4()}`,
      reminderId: editingReminder?._id,
      storeNo,
      staffId,
      title: form.title,
      notes: form.notes,
      dueAt,
      snoozedUntil: null,
      status: "active",
    }

    const operation = editingReminder ? "updateReminder" : "createReminder"

    try {
      const result = await window.electronAPI.realmOperation(operation, payload)
      if (result.success) {
        toast({
          title: editingReminder ? "Reminder updated" : "Reminder added",
          description: form.title,
        })
        resetForm()
        await fetchReminders({ quiet: true })
      } else {
        toast({
          title: "Could not save reminder",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Could not save reminder",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const runReminderAction = async (operation, payload, successTitle) => {
    try {
      const result = await window.electronAPI.realmOperation(operation, {
        reminderId: payload._id,
        storeNo,
        staffId,
        ...payload,
      })

      if (result.success) {
        toast({
          title: successTitle,
          description: payload.title,
        })
        await fetchReminders({ quiet: true })
      } else {
        toast({
          title: "Reminder action failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Reminder action failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const snoozeReminder = (reminder, snoozedUntil, label) => {
    runReminderAction("snoozeReminder", { ...reminder, snoozedUntil }, `Snoozed ${label}`)
  }

  const renderReminder = (reminder) => {
    const reminderIsDue = isDue(reminder)
    const effectiveDueAt = getEffectiveDueAt(reminder)
    const isSnoozed = Boolean(reminder.snoozedUntil && reminder.status === "active")

    return (
      <div key={reminder._id} className="border-b last:border-b-0 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium leading-tight break-words">{reminder.title}</h3>
              {reminderIsDue && <Badge variant="destructive" className="rounded-md">Due</Badge>}
              {isSnoozed && !reminderIsDue && <Badge variant="secondary" className="rounded-md">Snoozed</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {formatDateTime(effectiveDueAt)}
            </p>
            {reminder.notes && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{reminder.notes}</p>
            )}
          </div>
          {reminder.status === "active" && (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(reminder)} title="Edit reminder">
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit reminder</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => runReminderAction("completeReminder", reminder, "Reminder completed")}
                title="Mark done"
              >
                <Check className="h-4 w-4" />
                <span className="sr-only">Mark done</span>
              </Button>
            </div>
          )}
          {reminder.status === "done" && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => runReminderAction("archiveReminder", reminder, "Reminder deleted")}
              title="Delete reminder"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete reminder</span>
            </Button>
          )}
        </div>

        {reminder.status === "active" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => snoozeReminder(reminder, new Date(Date.now() + 10 * 60000).toISOString(), "10 minutes")}
            >
              10 min
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => snoozeReminder(reminder, new Date(Date.now() + 60 * 60000).toISOString(), "1 hour")}
            >
              1 hour
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => snoozeReminder(reminder, getTomorrowMorningIso(), "until tomorrow")}
            >
              Tomorrow
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => runReminderAction("archiveReminder", reminder, "Reminder deleted")}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Personal reminders">
          <AlarmClock className="h-5 w-5" />
          {dueCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-lg px-1 text-center">
              {dueCount}
            </Badge>
          )}
          <span className="sr-only">Personal reminders</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[82vh] max-w-[760px] flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlarmClock className="h-5 w-5" />
            Personal Reminders
          </DialogTitle>
          <DialogDescription>
            Keep track of things that do not belong in sales, stock, finance, or customer records.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="border-b px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <Label htmlFor="reminder-title">Title</Label>
              <Input
                id="reminder-title"
                placeholder="What should you remember?"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-due">Remind me at</Label>
              <Input
                id="reminder-due"
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Label htmlFor="reminder-notes">Notes</Label>
            <Textarea
              id="reminder-notes"
              className="min-h-[70px]"
              placeholder="Optional details"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            {editingReminder && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSaving || !canUseReminders}>
              <Plus className="mr-2 h-4 w-4" />
              {editingReminder ? "Update" : "Add"}
            </Button>
          </div>
        </form>

        <Tabs defaultValue="active" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-4 grid w-[260px] grid-cols-2">
            <TabsTrigger value="active">Active ({activeReminders.length})</TabsTrigger>
            <TabsTrigger value="done">Done ({completedReminders.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-5">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading reminders...</div>
              ) : activeReminders.length > 0 ? (
                <div className="rounded-md border">{activeReminders.map(renderReminder)}</div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No active reminders</div>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="done" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-5">
              {completedReminders.length > 0 ? (
                <div className="rounded-md border">{completedReminders.map(renderReminder)}</div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No completed reminders</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
