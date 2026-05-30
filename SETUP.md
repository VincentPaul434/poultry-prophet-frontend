# Poultry Prophet Frontend - Setup Guide

## Project Overview

A complete mobile-first PWA for game fowl breeding management covering:
- **Module 1**: Handler data entry (brooding & ranging forms)
- **Module 2**: Backend processing (Spring Boot REST API)
- **Module 3**: Manager analytics & selection interface

## Quick Start

### 1. Environment Variables

Create a `.env.local` file in the project root:

```env
# Spring Boot API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api

# Supabase Auth (if implementing JWT)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` - will automatically redirect to `/login`

### 3. Test Credentials

Use your farm's handler or manager account:
- **Handler**: Can access data entry dashboard and forms
- **Manager**: Can access analytics dashboard and selection interface

## Architecture

### Authentication Flow

```
Login Page → Axios + JWT Token → AuthProvider Context
                    ↓
            Protected Routes (Role-based)
            ├── /data-entry (handler)
            ├── /dashboard (manager)
            └── /selection (manager)
```

### File Structure

```
app/
├── page.tsx                        # Redirects to /login
├── login/
│   └── page.tsx                   # Login form
├── data-entry/
│   ├── page.tsx                   # Handler dashboard
│   ├── brooding/[batchId]/
│   │   └── page.tsx               # Brooding form
│   ├── ranging/[batchId]/
│   │   └── page.tsx               # Ranging form
│   └── entries/[batchId]/
│       └── page.tsx               # Entry history
├── dashboard/
│   ├── page.tsx                   # Manager batch list
│   └── [batchId]/
│       └── page.tsx               # Batch analytics
└── selection/
    ├── page.tsx                   # Selection batch list
    └── [batchId]/
        └── page.tsx               # Ranking & decisions

components/
├── data-entry/
│   ├── brooding-form.tsx          # Multi-step brooding form
│   └── ranging-form.tsx           # Multi-step ranging form
├── dashboard/
│   └── batch-overview.tsx         # KPI cards & charts
├── selection/
│   ├── ranking-table.tsx          # Sortable ranking table
│   └── weights-adjuster.tsx       # Scoring weights modal
└── shared/
    ├── header.tsx                 # Top navigation
    └── navigation.tsx             # Tab navigation

lib/
├── types.ts                       # TypeScript interfaces
├── api-client.ts                  # Axios instance + interceptors
├── auth-context.tsx               # Auth state provider
└── constants.ts                   # API endpoints, thresholds
```

## Key Features Implemented

### Module 1: Data Entry
- ✅ Multi-step brooding form (temp, humidity, ventilation, mortality, feed/water intake, health observations)
- ✅ Multi-step ranging form (outdoor temp, precipitation, predators, forage, health issues, predator losses)
- ✅ Entry history with edit/delete functionality
- ✅ Data entry dashboard with batch overview and quick-entry shortcuts
- ✅ Client-side validation (React Hook Form + Zod)

### Module 3: Analytics & Selection
- ✅ Batch dashboard with KPI cards (BHI, mortality, temperature, feed intake)
- ✅ BHI trend chart and indicator radar chart
- ✅ Bird score distribution bar chart
- ✅ Sortable ranking table with decision controls
- ✅ Weights adjuster modal for CRS customization
- ✅ Decision summary cards (Advance/Hold/Reject counts)
- ✅ Selection finalization with API integration

### Infrastructure
- ✅ Supabase Auth JWT integration
- ✅ Axios API client with request/response interceptors
- ✅ Protected routes with role-based access
- ✅ Error handling and loading states
- ✅ Toast notifications (via sonner)
- ✅ Responsive mobile-first design (shadcn/ui + Tailwind)

## API Integration

### Expected Endpoints (Spring Boot)

The frontend expects these endpoints to be available:

```
# Authentication
POST   /api/auth/login
POST   /api/auth/logout

# Batch Management
GET    /api/batches
GET    /api/batches/:batchId
GET    /api/handlers/assigned-batches

# Data Entry (Module 1)
GET    /api/batches/:batchId/brooding-records
POST   /api/batches/:batchId/brooding-records
PUT    /api/brooding-records/:recordId
DELETE /api/brooding-records/:recordId

GET    /api/batches/:batchId/ranging-records
POST   /api/batches/:batchId/ranging-records
PUT    /api/ranging-records/:recordId
DELETE /api/ranging-records/:recordId

POST   /api/birds/:birdId/weight-records

# Analytics (Module 3)
GET    /api/batches/:batchId/indicators
GET    /api/batches/:batchId/ranking
GET    /api/batches/:batchId/scoring-weights
PUT    /api/batches/:batchId/scoring-weights

# Selection Decisions
POST   /api/batches/:batchId/selection-decisions
POST   /api/batches/:batchId/selection/finalize
```

## Development Workflow

### Adding a New Form Field

1. Update the Zod schema in the form component
2. Add the field to the multi-step form
3. Test validation before submission

### Adding a New API Endpoint

1. Call `apiClient.get/post/put/delete()` from the component
2. Handle 401/403 errors (automatically redirects to login)
3. Add error handling with `useToast()`

### Adding a New Chart

1. Import from Recharts (`LineChart`, `BarChart`, `RadarChart`, etc.)
2. Prepare data in expected format
3. Wrap in `ResponsiveContainer` for responsiveness

## Testing Checklist

- [ ] Login redirects to /data-entry for handlers
- [ ] Login redirects to /dashboard for managers
- [ ] Brooding form validation works (temperature range, required fields)
- [ ] Ranging form accepts predator loss details
- [ ] Entry history displays past records
- [ ] Batch dashboard loads KPI cards and charts
- [ ] Ranking table sorts by CRS and other scores
- [ ] Weights adjuster updates scoring weights
- [ ] Decision buttons (Advance/Hold/Reject) work
- [ ] Mobile responsive design works on 375px viewport

## Future Enhancements

### Phase 2
- Offline data sync with Workbox
- Supabase Realtime subscriptions for live updates
- Image upload to Vercel Blob for ranging photos
- PDF export of selection decisions
- Batch historical replay and scenario modeling

### Phase 3
- Machine learning predictions for weight curves
- SMS/email notifications
- Admin dashboard for system configuration
- Audit logging for all decisions
- Advanced filtering and search

## Troubleshooting

### Login not working
- Check `NEXT_PUBLIC_API_BASE_URL` points to Spring Boot server
- Verify Spring Boot `/api/auth/login` endpoint exists
- Check JWT token format in response

### Data not loading
- Check browser console for API errors
- Verify authorization header is being sent (check network tab)
- Confirm user has permission to view batch

### Charts not rendering
- Ensure mock data is properly formatted
- Check ResponsiveContainer has a parent with height
- Verify Recharts library is installed

## Support

For issues or questions:
1. Check the endpoint implementations in Spring Boot
2. Verify API response structure matches `lib/types.ts`
3. Review console logs for error messages
4. Inspect network requests in browser DevTools
