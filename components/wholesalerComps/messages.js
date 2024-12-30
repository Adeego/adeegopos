"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Mail, Bell, Inbox, Archive } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

export function MessageDialog() {
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAllMessages();
  }, [])

  const fetchAllMessages = async () => {
    try {
      const result = await window.electronAPI.message('getAllMessages');
      if (result.success) {
          setMessages(result.messages);
      }
    } catch (error) {
        console.error(error)
    }
  }

  const filteredMessages = messages.filter(message =>
    message.header.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.from.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const unreadCount = messages.filter((message) => !message.read).length

  const handleUpdateMessage = async (updatedMessage) => {
    try {
      const result = await window.electronAPI.message('updateMessage', updatedMessage);
      if (result.success) {
        // Update the local state to reflect the read status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg._id === updatedMessage._id ? { ...msg, read: true } : msg
          )
        );
        
        // If the current selected message is the one being updated, update it
        if (selectedMessage && selectedMessage._id === updatedMessage._id) {
          setSelectedMessage({ ...selectedMessage, read: true });
        }

        toast({
          title: "Success",
          description: "Message marked as read",
        });
      }
    } catch (error) {
      console.error("Error updating message:", error);
      toast({
        title: "Error",
        description: "Failed to mark message as read",
        variant: "destructive"
      });
    }
  }

  function renderMessageList(messages) {
    // Helper function to strip markdown syntax (basic implementation)
    const stripMarkdown = (text) => {
      if (!text) return '';
      return text
        // Remove headers
        .replace(/#{1,6}\s/g, '')
        // Remove bold/italic
        .replace(/[*_]{1,3}(.*?)[*_]{1,3}/g, '$1')
        // Remove links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove blockquotes
        .replace(/^\s*>\s/gm, '')
        // Remove lists
        .replace(/^\s*[-*+]\s/gm, '')
        .replace(/^\s*\d+\.\s/gm, '')
    };

    return messages.map((message) => (
      <button
        key={message._id}
        onClick={() => setSelectedMessage(message)}
        className={`w-full text-left p-4 hover:bg-accent transition-colors border-b last:border-b-0 ${
          selectedMessage?._id === message._id ? "bg-accent" : ""
        }`}
      >
      <h3 className="font-medium truncate">{stripMarkdown(message.header)}</h3>
      <p className="text-sm text-muted-foreground truncate">{stripMarkdown(message.from)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(message.createdAt).toLocaleString()}
        </p>
      </button>
    ))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute rounded-lg text-center -top-1 -right-1 px-1 min-w-[1.25rem] h-5">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90%] h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Notifications</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-10 w-[300px] mr-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          <Tabs defaultValue="unread" className="flex flex-col w-1/3 border-r">
            <TabsList className="flex justify-start px-2 pt-2 border-b">
              <TabsTrigger value="unread" className="flex items-center">
                <Inbox className="mr-2 h-4 w-4" />
                Unread
              </TabsTrigger>
              <TabsTrigger value="read" className="flex items-center">
                <Archive className="mr-2 h-4 w-4" />
                Read
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1">
              <TabsContent value="unread" className="m-0">
                {renderMessageList(filteredMessages.filter((m) => !m.read))}
              </TabsContent>
              <TabsContent value="read" className="m-0">
                {renderMessageList(filteredMessages.filter((m) => m.read))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
            <div className="w-2/3 flex flex-col">
              <ScrollArea className="flex-1 p-6">
                {selectedMessage ? (
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">{selectedMessage.header}</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                          From: {selectedMessage.from} <br />
                          Sent: {new Date(selectedMessage.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!selectedMessage.read && (
                        <Button 
                          onClick={() => handleUpdateMessage({
                            ...selectedMessage, 
                            read: true
                          })}
                        >
                          Mark as Done
                        </Button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <p>{selectedMessage.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a message to view its content</p>
                  </div>
                )}
              </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
