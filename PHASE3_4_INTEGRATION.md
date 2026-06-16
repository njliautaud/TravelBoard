# Phase 3-4 Integration Notes

All Phase 3-4 components are built as standalone files that do NOT modify any Phase 1-2 files.
After Phase 1-2 completes, the following wiring needs to happen:

## Wire into AppShell.tsx

Add nav items or triggers for:
- **User Profile** — add a profile icon in the nav/header that opens `<UserProfile />`
- **Activity Feed** — add a bell/activity icon that toggles `<ActivityFeed onClose={...} />`
- **Feature Walkthrough** — import `useWalkthroughState` from `FeatureWalkthrough`, call `startWalkthrough()` on first visit

## Wire into DealsView.tsx

For each deal card:
- Add `<ShareButton deal={...} />` from `ShareDeal.tsx`
- Add a heart/bookmark toggle using `useFavorites(origin)` from `FavoritesPanel.tsx`
- Add `<FlightStatusIndicator transfers={deal.transfers} durationMin={deal.duration} compact />` from `FlightStatusIndicator.tsx`
- Add a "Saved Deals" button that opens `<FavoritesPanel origin={origin} currentFares={fares} onClose={...} />`

## Wire into ToolsView.tsx

Add these tools to the TOOLS array:
- **Savings Dashboard**: `{ id: "savings", label: "Savings Dashboard", ... }` rendering `<SavingsDashboard />`
- **Packing List**: `{ id: "packing", label: "Packing List", ... }` rendering `<PackingSuggestions />`

## Wire into SettingsView.tsx

Add a "Data Export" button that opens `<DataExport onClose={...} />`

## Wire into CommunityView.tsx

Add Activity Feed as a section option.

## Wire into FlightTracker.tsx

Import and render `<FlightStatusIndicator />` alongside tracked flight data.

## Prisma Schema

The SavedDeal functionality uses the existing `Location` model's `starred` boolean field
instead of creating a new model, to avoid schema conflicts with Phase 1-2.
If a dedicated `SavedDeal` model is preferred later, add:

```prisma
model SavedDeal {
  id      String   @id @default(cuid())
  userId  String
  dealId  String
  origin  String
  savedAt DateTime @default(now())
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@unique([userId, dealId])
}
```

Then update `User` model with `savedDeals SavedDeal[]` relation.

## New API Routes Created

- `GET /api/savings?days=90` — savings dashboard data
- `GET/POST/DELETE /api/saved-deals` — bookmark management
- `GET /api/export/json` — full data export as JSON
- `GET /api/export/csv` — full data export as CSV
- `GET /api/packing?lat=X&lon=Y&destination=Paris&departDate=2026-07-01` — packing suggestions
- `GET /api/profile` — user profile stats

## New Components Created

### Phase 3 (Advanced Features)
- `SavingsDashboard.tsx` — savings over time with bar chart
- `FavoritesPanel.tsx` + `useFavorites` hook — saved deals panel
- `ShareDeal.tsx` + `ShareButton` + `SharedDealView` — deal sharing
- `ActivityFeed.tsx` — real-time activity panel
- `DataExport.tsx` — JSON/CSV export dialog
- `UserProfile.tsx` — profile with stats, badges, XP

### Phase 4 (Polish)
- `FeatureWalkthrough.tsx` + `useWalkthroughState` — onboarding tour
- `PackingSuggestions.tsx` — weather-aware packing checklist
- `FlightStatusIndicator.tsx` — stop count + duration display

### CSS Animations Added (globals.css)
- `animate-slide-in-right` — activity feed slide-in
- `animate-stagger-item` — staggered list item animation
- `animate-count-up` — number counting animation
- `animate-scale-in` — modal scale-in
