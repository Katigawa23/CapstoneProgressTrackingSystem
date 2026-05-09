"use client"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"

const CollapsibleTriggerPrimitive =
  CollapsiblePrimitive.CollapsibleTrigger as unknown as React.ComponentType<
    React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger> & {
      suppressHydrationWarning?: boolean
    }
  >

const CollapsibleContentPrimitive =
  CollapsiblePrimitive.CollapsibleContent as unknown as React.ComponentType<
    React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent> & {
      suppressHydrationWarning?: boolean
    }
  >

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsibleTriggerPrimitive
      data-slot="collapsible-trigger"
      suppressHydrationWarning
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsibleContentPrimitive
      data-slot="collapsible-content"
      suppressHydrationWarning
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
