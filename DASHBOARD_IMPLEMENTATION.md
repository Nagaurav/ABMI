# Dashboard Implementation Guide

## Overview
This document describes the full-stack dashboard implementation for the ABMI interview platform, providing users with comprehensive analytics and performance tracking.

## Architecture

### 1. Database Layer

#### Migration File
- **Location**: `supabase/migrations/20251019000000_dashboard_enhancements.sql`
- **Purpose**: Adds necessary columns and indexes to support dashboard functionality

#### Schema Changes

**interviews table**:
- `session_date` (date): When the interview was conducted
- `status` (text): Interview status (pending, in_progress, completed, pending_analysis)

**feedback table**:
- `overall_score` (integer): Calculated average score across all metrics
- `key_improvement_area` (text): Primary area for improvement identified by LLM

**Indexes** (for performance):
- `idx_interviews_user_created`: On (user_id, created_at DESC)
- `idx_interviews_user_session_date`: On (user_id, session_date DESC)
- `idx_feedback_user`: On (user_id)
- `idx_feedback_interview`: On (interview_id)

**Automatic Calculations**:
- Trigger `trigger_calculate_overall_score` automatically calculates `overall_score` from individual feedback metrics

### 2. Backend API

#### Endpoint
- **Route**: `GET /api/dashboard/summary`
- **Authentication**: JWT Bearer token (Supabase auth)
- **Location**: `server/routes/dashboard.js`

#### Response Structure
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "averageScore": 85,
  "interviewsCompleted": 12,
  "keyImprovementArea": "Clarity of expression",
  "performanceHistory": [
    { "date": "2025-10-12", "score": 75 },
    { "date": "2025-10-15", "score": 78 }
  ],
  "interviewHistory": [
    {
      "interview_session_id": "uuid-1234",
      "date": "2025-10-18",
      "duration": 932,
      "score": 82,
      "status": "completed"
    }
  ]
}
```

#### Security
- JWT authentication middleware validates Supabase tokens
- Row-level security (RLS) ensures users only access their own data
- Service role key used server-side for elevated permissions

### 3. Frontend Implementation

#### Custom Hook
- **Location**: `src/hooks/useDashboard.ts`
- **Purpose**: Fetches dashboard data from backend API
- **Features**:
  - Automatic token management via Supabase
  - Error handling and loading states
  - Refetch capability for manual refresh

#### Dashboard Component
- **Location**: `src/pages/Dashboard.tsx`
- **Features**:
  1. **Personalized Greeting**: Displays user's name
  2. **KPI Cards**: Shows key metrics (interviews completed, average score, improvement area)
  3. **Performance Chart**: Visual representation of score progression over time
  4. **Quick Actions**: Buttons to start new interview, view analysis, etc.
  5. **Interview History**: List of recent interviews with scores and analysis links

#### UI Components Used
- **Charts**: Recharts library for performance visualization
- **Animations**: Framer Motion for smooth transitions
- **Icons**: Heroicons for consistent iconography
- **Styling**: Tailwind CSS with dark theme

## Setup Instructions

### 1. Database Migration

Run the migration to add dashboard support:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration file manually in Supabase Dashboard
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Supabase Configuration (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend API URL
VITE_API_URL=http://localhost:4000
```

### 3. Start the Backend Server

```bash
cd server
node index.js
# Server will run on http://localhost:4000
```

### 4. Start the Frontend

```bash
npm run dev
# Frontend will run on http://localhost:3000
```

## Data Flow

1. **User Login**: User authenticates via Supabase Auth
2. **Dashboard Load**: Frontend calls `useDashboard()` hook
3. **Token Retrieval**: Hook gets JWT token from Supabase session
4. **API Request**: Frontend sends authenticated request to `/api/dashboard/summary`
5. **Backend Processing**: 
   - Validates JWT token
   - Queries database for user's data
   - Aggregates statistics and history
6. **Response**: Backend returns JSON with all dashboard data
7. **Rendering**: Frontend displays data in UI components

## Key Features

### Performance Tracking
- Visual chart showing score progression over time
- Average score calculation across all interviews
- Identification of improvement trends

### Interview History
- Last 5 interviews displayed
- Quick access to detailed analysis
- Duration and score at a glance

### Actionable Insights
- Key improvement area highlighted
- Direct link to start new interview
- Easy navigation to analysis and recordings

## Error Handling

- **No Session**: Redirects to login if user not authenticated
- **API Errors**: Displays user-friendly error message with retry option
- **Empty State**: Gracefully handles users with no interview data
- **Loading State**: Shows spinner during data fetch

## Performance Optimizations

1. **Database Indexes**: Fast queries on user_id and dates
2. **Single API Call**: All dashboard data fetched in one request
3. **Calculated Fields**: Overall score computed via database trigger
4. **Efficient Queries**: Limited result sets (last 10 for chart, last 5 for history)

## Future Enhancements

- Real-time updates using Supabase subscriptions
- Export dashboard data as PDF
- Customizable date ranges for performance history
- Comparison with average user performance
- Goal setting and progress tracking
- Email reports for weekly/monthly summaries

## Troubleshooting

### Dashboard shows "Loading..." indefinitely
- Check that backend server is running on port 4000
- Verify `VITE_API_URL` is set correctly in `.env`
- Check browser console for network errors

### "No active session" error
- Ensure user is logged in
- Check Supabase configuration is correct
- Verify JWT token is being sent in Authorization header

### No data displayed
- Confirm user has completed interviews
- Check that feedback records exist in database
- Verify RLS policies allow user to read their own data

## Testing

### Manual Testing Checklist
- [ ] Dashboard loads without errors
- [ ] User name displays correctly
- [ ] KPI cards show accurate numbers
- [ ] Performance chart renders with data
- [ ] Interview history lists recent sessions
- [ ] "View Analysis" buttons navigate correctly
- [ ] Error states display properly
- [ ] Loading states show during fetch

### Sample Data Creation
To test with sample data, insert records into the database:

```sql
-- Insert sample interview
INSERT INTO interviews (user_id, title, type, session_date, status, score)
VALUES (auth.uid(), 'Sample Interview', 'technical', CURRENT_DATE, 'completed', 85);

-- Insert sample feedback
INSERT INTO feedback (interview_id, user_id, overall_score, key_improvement_area)
VALUES (
  (SELECT id FROM interviews WHERE user_id = auth.uid() LIMIT 1),
  auth.uid(),
  85,
  'Practice more technical questions'
);
```

## Maintenance

- **Database**: Monitor query performance, add indexes as needed
- **API**: Log errors, monitor response times
- **Frontend**: Track user engagement with dashboard features
- **Security**: Regularly update dependencies, review RLS policies
