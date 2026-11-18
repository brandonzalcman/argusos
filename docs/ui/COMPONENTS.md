# @argus/ui components

Everything is exported from `@argus/ui`; icons from `@argus/ui/icons` (lucide, so apps share one version). Styles come from `@argus/ui/styles.css`, which apps/web already imports in `src/index.css`.

See [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) for the visual language. Storybook: `pnpm --filter @argus/ui dev` (port 6006).

## Rules for page authors (read first)

- **Use tokens, not raw colours.** Tailwind's default palette is removed. Use role utilities:
  `bg-canvas` (app background), `bg-surface`, `bg-surface-sunken`, `bg-surface-raised`, `bg-surface-hover`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-border`, `border-border-strong`, `bg-accent`/`text-on-accent`, `text-accent-text`, `bg-accent-subtle`, and per status tone `text-{tone}`, `bg-{tone}-subtle`, `bg-{tone}-solid` for `info | success | warning | high | critical`. `bg-gray-100`, `text-red-600` etc. **will not generate**.
- **Type scale:** `text-xs` 12 · `text-sm` 13 · `text-base` 14 (UI body) · `text-md` 16 · `text-lg` 18 · `text-xl` 20 · `text-2xl` 24 · `text-3xl` 30. `font-mono` for ids, coordinates and times; numbers are tabular in tables and `<time>`.
- **Density-aware sizes:** `h-(--argus-control-h)`, `h-(--argus-row-h)`, `p-(--argus-panel-p)`, `gap-(--argus-gap)`, `p-(--argus-page-p)`.
- **Radii:** `rounded-sm` (4px inputs, cells, buttons), `rounded-md` (8px cards, panels, menus), `rounded-lg` (12px dialogs). **Shadows:** `shadow-sm` cards, `shadow-md` popovers, `shadow-lg` dialogs.
- **Every route** = `PageContainer` > `PageHeader` > content in `Panel`/`Card`. Unknown context shows "Not selected"; disconnected data shows `EmptyState`/`ErrorState` explaining that it is not connected. Never fabricate rows or figures.
- **Status never by colour alone:** use `StatusPill` (icon + text) or `StatusDot` with a label.

## Layout

### AppShell, PageContainer, useAppShell
`AppShell` props: `sidebar`, `topBar`, `children`, `banners?`, `sidebarCollapsed?`, `defaultSidebarCollapsed?`, `onSidebarCollapsedChange?`. Desktop (≥1024px) shows a fixed sidebar (collapsible to icons); below that the sidebar becomes a drawer opened by the top bar menu button. Includes the skip link, `<main id="argus-main-content">` and a `TooltipProvider`.

`PageContainer` props: `width?: "narrow" | "default" | "wide" | "full"` (`default` max 72rem), `className?`. Gives page padding and vertical rhythm.

```tsx
<PageContainer width="wide">
  <PageHeader title="Incidents" description="…" actions={<Button variant="primary">New incident</Button>} />
  <Panel title="Active">…</Panel>
</PageContainer>
```
A11y: one `<main>`; skip link first in tab order; drawer is a modal dialog with focus trap.

### Sidebar, SidebarSection, SidebarItem, ArgusMark
`Sidebar` props: `brand?`, `logo?`, `children`, `footer?`, `aria-label?`. `SidebarSection`: `title?`, `children`. `SidebarItem`: `icon`, `label`, `children` (a link element, e.g. TanStack `<Link to="/x" />`), `active?`, `badge?`. Active styling follows `aria-current="page"` / `data-status="active"` set by the router. Collapsed mode shows icons with tooltips and keeps `aria-label`s.

```tsx
<SidebarItem icon={<Siren />} label="Incidents"><Link to="/incidents" /></SidebarItem>
```

### TopBar
Props: `activeIncidentLabel?`, `incidentLevel?: { label; status: StatusLevel } | null`, `operationalPeriodLabel?`, `positionLabel?` (null/empty renders **"Not selected"**), `connection` (use `<ConnectionIndicator variant="pill" />`), `actions?`, `onOpenCommandPalette?`, `commandShortcut?`. Context is a `<dl>` in a labelled region so screen readers read "Incident: Not selected".

### PageHeader
Props: `title`, `description?`, `eyebrow?`, `breadcrumbs?: { label; link? }[]`, `actions?`, `meta?`. Renders the route's single `<h1>`.

### Card, Panel
`Card`: bordered surface; `elevation?: "flat" | "raised"`, `flush?`. `Panel`: titled `<section>` with `title`, `description?`, `status?`, `actions?`, `footer?`, `headingLevel?: 2|3|4`, `flush?` (no body padding, for tables/maps), `bodyClassName?`. The standard container for board blocks.

```tsx
<Panel title="Resource requests" status={<StatusPill status="stale" />} actions={<IconButton label="Refresh" icon={<RotateCw />} />}>
  <EmptyState title="No requests" description="Requests for this incident appear here." />
</Panel>
```

### SplitPane
Props: `orientation?: "horizontal" | "vertical"`, `first`, `second`, `size?`/`defaultSize?` (percent), `onSizeChange?`, `onSizeCommit?` (persist here), `minSize?`, `maxSize?`, `separatorLabel` (required), `className?`. The divider is a focusable ARIA window splitter: arrows (Shift = 10%), Home/End; RTL aware. Pop-out windows are TODO.

## Actions

### Button
Props: `variant?: "primary" | "secondary" | "ghost" | "danger" | "link"`, `size?: "sm" | "md" | "lg"`, `loading?`, `leadingIcon?`, `trailingIcon?`, `asChild?` (style a router `Link`), plus native button props. One `primary` per view; `danger` only behind confirmation. `loading` sets `aria-busy` and blocks repeat clicks. `buttonClasses(variant, size, className)` is exported for other elements.

### IconButton
Props: `label` (required accessible name + tooltip), `icon`, `variant?`, `size?`, `shortcut?`, `showTooltip?`, `tooltipSide?`. Never ship an icon-only control without it.

### DropdownMenu
`DropdownMenu`, `DropdownMenuTrigger` (`asChild`), `DropdownMenuContent` (`side?`, `align?`), `DropdownMenuItem` (`icon?`, `shortcut?`, `destructive?`, `onSelect?`), `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup` + `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuSub*`. Radix keyboard model (arrows, typeahead, Escape).

### CommandPalette, useCommandPaletteShortcut
Props: `open`, `onOpenChange`, `sources: CommandPaletteSource[]`, `onSelect(item)`, `placeholder?`, `debounceMs?`. A source is `{ id, label, search(query, signal) => Promise<CommandPaletteItem[]> }`; `CommandPaletteItem` matches apps/web `CommandDescriptor` (`id, title, kind, targetId`, plus optional `subtitle`, `shortcut`, `keywords`). Sources run in parallel; a failing source shows its own "unavailable" row. `filterCommands(items, query)` ranks static items. The app layout already mounts it with ⌘K/Ctrl+K and wires `services.commandPalette` (refuses to search without session scope).
A11y: combobox + listbox with `aria-activedescendant`; results count announced politely.

## Forms

### Field, Input, Textarea
`Field` props: `label`, `description?`, `error?`, `required?`, `disabled?`, `hideLabel?`, `id?`. Wraps one control and wires `id`, `aria-describedby`, `aria-invalid`, `required`. `Input`: native props + `invalid?`, `leadingIcon?`, `mono?`. `Textarea`: native props + `invalid?`.

```tsx
<Field label="Callsign" description="As used on radio" error={errors.callsign} required>
  <Input mono value={v} onChange={…} />
</Field>
```
Errors render with an icon and text, not colour alone.

### Select
Props: `options: (SelectOption | SelectOptionGroup)[]`, `value?`/`defaultValue?`, `onValueChange?`, `placeholder?`, `disabled?`, `required?`, `invalid?`, `name?`, `id?`, `aria-label?`, `size?: "sm" | "md"`. Works inside `Field`.

### Checkbox
Props: `label?`, `description?`, `checked?: boolean | "indeterminate"`, `defaultChecked?`, `onCheckedChange?`, `disabled?`, `required?`, `name?`, `value?`, `id?`, `aria-label?` (required when no label).

### Switch
Props: `label?`, `description?`, `checked?`, `defaultChecked?`, `onCheckedChange?`, `disabled?`, `showStateLabel?` (On/Off text, default true). For immediately-applied settings only.

### DensityControl
Props: `value`, `onChange`, `label?`, `hideLabel?`, `iconOnly?`. Native radio group styled as a segmented control.

### ThemeToggle, UIPreferencesProvider, useUIPreferences
`UIPreferencesProvider` (`defaultTheme?: "system" | "light" | "dark" | "high-contrast"`, `defaultDensity?`, `persist?`, `target?`) sets `data-argus-mode` / `data-argus-density` on `<html>` and configures Motion for reduced motion. `useUIPreferences()` → `{ theme, resolvedTheme, density, setTheme, setDensity }`. `ThemeToggle` props: `value`, `onChange`, `resolved?`. The app layout mounts both — pages just call `useUIPreferences()`.

## Overlays

### Dialog, DialogContent, ConfirmDialog
`Dialog`/`DialogTrigger`/`DialogClose` are Radix parts. `DialogContent` props: `title` (required), `description?`, `size?: "sm"|"md"|"lg"|"xl"`, `footer?`, `hideClose?`, `preventOutsideClose?`. `ConfirmDialog` props: `open`, `onOpenChange`, `title`, `itemName` (always shown), `description?`, `confirmLabel`, `cancelLabel?`, `destructive?`, `onConfirm` (may be async; shows progress). No dialog-on-dialog.

### Popover
`Popover`, `PopoverTrigger`, `PopoverContent` (`side?`, `align?`, `sideOffset?`, `aria-label?`), `PopoverClose`, `PopoverAnchor`. Non-modal.

### Tooltip, TooltipProvider
`Tooltip` props: `content`, `children` (one focusable element), `side?`, `align?`, `shortcut?`. Supplementary only — never the sole name of a control. `AppShell` provides the provider; Storybook too.

### Toast, useToast
`ToastProvider` (mounted by the app layout). `const { toast, dismiss } = useToast(); toast({ title, description?, tone?: "neutral"|"info"|"success"|"warning"|"critical", duration?, action?: { label, altText, onAction } })`. Critical toasts are assertive and persist until dismissed; others are polite and auto-dismiss after 6s. Use for "3 new events" and undo.

## Data display

### Table primitives
`TableContainer` (`maxHeight?`, scrolls with sticky header), `Table`, `TableCaption`, `TableHeader`, `TableBody`, `TableRow` (`selected?`, `highlighted?`, `interactive?`), `TableHead` (`align?`, `sort?: "ascending"|"descending"|"none"`, `onSort?` → renders a sort button and `aria-sort`), `TableCell` (`align?`, `mono?`, `muted?`), `TableStateRow` (`colSpan`, children = EmptyState/ErrorState/skeletons). For < ~500 rows; large live grids get the canvas grid later.

```tsx
<TableContainer maxHeight="24rem">
  <Table>
    <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Task</TableHead></TableRow></TableHeader>
    <TableBody>
      <TableStateRow colSpan={2}><EmptyState title="No tasks" /></TableStateRow>
    </TableBody>
  </Table>
</TableContainer>
```

### Tabs
`Tabs` (Radix root: `value`/`defaultValue`/`onValueChange`), `TabsList` (`aria-label` required), `TabsTrigger` (`value`, `count?`, `disabled?`), `TabsContent`.

### Badge, StatusPill, StatusDot
`Badge`: `tone?: "neutral"|"accent"|"info"|"success"|"warning"|"high"|"critical"`, `variant?: "subtle"|"outline"|"solid"`, `size?`, `icon?`. `StatusPill`: `status: "critical"|"high"|"medium"|"low"|"info"|"ok"|"stale"` (locked meanings, each with its own icon), `label?` (tenant terminology), `variant?`, `size?`, `attention?` (gentle pulse, reduced-motion safe). `StatusDot`: `tone`, `label`, `showLabel?`, `pulse?`.

### PresenceAvatars
Props: `people: { id, displayName, positionLabel? }[]`, `maxVisible?`, `label?`. Initials with tooltips; names are in the accessible list. Empty → "No one else viewing".

### ConnectionIndicator
Props: `state: "live"|"reconnecting"|"offline"|"polling"`, `lastUpdatedAt?` (ISO; never invented), `stateDetail?`, `variant?: "pill"|"full"` (default `full`). Polite live region.

### NewRowsIndicator
Props: `count`, `noun?`, `onShowNewRows?`. Renders nothing at 0; animated "N new rows" pill otherwise, without moving the list.

### FlashOnChange
Props: `value`, `children`, `as?: "span"|"div"`. Briefly tints content when `value` changes (Motion; reduced-motion safe).

### ConflictBanner
Props: `recordLabel`, `fields: { fieldId, fieldLabel, localValue, serverValue }[]`, `onKeepMine?`, `onKeepTheirs?`, `onReview?`. Shows both values in a table; `role="alert"`.

## States

### EmptyState
Props: `title`, `description?`, `icon?`, `action?`, `size?: "inline" | "page"`. Say what the area is, why it's empty and the next step.

### ErrorState
Props: `title` (what failed), `description?`, `onRetry?`, `retrying?`, `retryLabel?`, `reference?` (correlation id), `action?`, `size?`. Polite status region.

### Skeleton, SkeletonText, SkeletonGroup
`Skeleton` (`shape?: "block"|"text"|"circle"`, size via className), `SkeletonText` (`lines?`), `SkeletonGroup` (`label` announced, `aria-busy`). Use skeletons for content loading, not spinners.

### ScaffoldPage
Props: `title`, `description`, `implementationOrder`, `eyebrow?`, `icon?`, `children?`. Clean placeholder for unbuilt routes, labelled "Scaffold only — no operational data is loaded".

## Utilities and tokens
`cn(...classes)` (clsx + tailwind-merge), `focusRing` / `focusRingInset` class strings, `Kbd`. Tokens: `palette` (hex per mode, verified for AA in tests), `designTokens` (CSS var references for canvas/map renderers), `typeScale`, `radii`, `zIndex`, `motionTokens`, `densityTokens`, `statusTones`, `tones`.
