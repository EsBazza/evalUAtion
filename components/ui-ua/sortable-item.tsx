import * as React from "react"
import { Reorder, useDragControls } from "framer-motion"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SortableGroupProps<T> {
  values: T[]
  onReorder: (newValues: T[]) => void
  children: React.ReactNode
  className?: string
  as?: any
}

export function SortableGroup<T>({
  values,
  onReorder,
  children,
  className,
  as = "div",
}: SortableGroupProps<T>) {
  return (
    <Reorder.Group
      as={as}
      values={values}
      onReorder={onReorder}
      className={cn("space-y-4", className)}
    >
      {children}
    </Reorder.Group>
  )
}

export interface SortableItemProps {
  value: any
  children: React.ReactNode
  className?: string
  dragListener?: boolean
  as?: any
}

const DragControlsContext = React.createContext<any>(null)

export function SortableItem({
  value,
  children,
  className,
  dragListener = false,
  as = "div",
}: SortableItemProps) {
  const dragControls = useDragControls()

  return (
    <DragControlsContext.Provider value={dragControls}>
      <Reorder.Item
        as={as}
        value={value}
        dragListener={dragListener}
        dragControls={dragControls}
        className={cn("list-none focus:outline-none select-none", className)}
      >
        {children}
      </Reorder.Item>
    </DragControlsContext.Provider>
  )
}

export function DragHandle({ className }: { className?: string }) {
  const dragControls = React.useContext(DragControlsContext)

  return (
    <div
      onPointerDown={(event) => {
        if (dragControls) {
          dragControls.start(event)
        }
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded-md transition-colors shrink-0 touch-none select-none flex items-center justify-center",
        className
      )}
    >
      <GripVertical className="size-4 text-muted-foreground/60" />
    </div>
  )
}
