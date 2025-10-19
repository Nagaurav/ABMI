# Dashboard Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Configure Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```env
# Get these from https://app.supabase.com/project/_/settings/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Backend API URL
VITE_API_URL=http://localhost:4000
```

### Step 2: Apply Database Migration

The migration file is already created at:
`supabase/migrations/20251019000000_dashboard_enhancements.sql`

**Option A - Using Supabase CLI:**
```bash
supabase db push
```

**Option B - Manual (Supabase Dashboard):**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of the migration file
4. Run the SQL

### Step 3: Start the Servers

**Terminal 1 - Backend Server:**
```bash
cd server
node index.js
```
Server runs on `http://localhost:4000`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Frontend runs on `http://localhost:3000`

## ✅ Verify It's Working

1. Navigate to `http://localhost:3000`
2. Sign in with your credentials
3. You should see the dashboard with:
   - Your name in the greeting
   - KPI cards (interviews completed, average score, key improvement)
   - Performance history chart
   - Recent interviews list

## 📊 What's Included

### Backend (`server/routes/dashboard.js`)
- **Endpoint**: `GET /api/dashboard/summary`
- **Authentication**: JWT Bearer token
- **Returns**: User stats, performance history, interview history

### Frontend (`src/pages/Dashboard.tsx`)
- Personalized greeting
- 3 KPI cards
- Performance chart (Recharts)
- Interview history with "View Analysis" buttons
- Quick action buttons

### Database (`supabase/migrations/20251019000000_dashboard_enhancements.sql`)
- New columns: `session_date`, `status`, `overall_score`, `key_improvement_area`
- Performance indexes
- Auto-calculation trigger for `overall_score`

## 🔧 Troubleshooting

**Dashboard stuck on loading?**
- Check backend is running on port 4000
- Verify `.env` has correct `VITE_API_URL`

**"No active session" error?**
- Make sure you're logged in
- Check Supabase credentials in `.env`

**No data showing?**
- You need at least one completed interview with feedback
- Check database has records in `interviews` and `feedback` tables

## 📝 Next Steps

1. Complete an interview to see real data
2. Check the performance chart updates
3. View detailed analysis from interview history
4. Customize the dashboard (see `DASHBOARD_IMPLEMENTATION.md` for details)

## 🎯 Key Files Modified/Created

```
✅ supabase/migrations/20251019000000_dashboard_enhancements.sql (NEW)
✅ server/routes/dashboard.js (NEW)
✅ server/index.js (UPDATED - added dashboard routes)
✅ src/hooks/useDashboard.ts (UPDATED - uses backend API)
✅ src/pages/Dashboard.tsx (UPDATED - real data integration)
✅ src/lib/database.types.ts (UPDATED - new columns)
✅ .env.example (UPDATED - added VITE_API_URL)
```

For detailed documentation, see `DASHBOARD_IMPLEMENTATION.md`
