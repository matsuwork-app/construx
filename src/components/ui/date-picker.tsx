import * as React from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
  date,
  setDate,
  className,
}: {
  date?: string
  setDate: (date: string) => void
  className?: string
}) {
  const parsedDate = date ? new Date(date) : undefined

  return (
    <Popover>
      <PopoverTrigger render={
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal rounded-none border-dashboard-line",
            !date && "text-muted-foreground",
            className
          )}
        />
      }>
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(parsedDate!, "PPP", { locale: ja }) : <span>日付を選択</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(d) => setDate(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
