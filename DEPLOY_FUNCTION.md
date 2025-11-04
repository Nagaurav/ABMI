# Deploying the Supabase Function

## Option 1: Deploy via Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to https://app.supabase.com
   - Select your project

2. **Navigate to Edge Functions**
   - In the left sidebar, click on "Edge Functions"
   - Or go to: Project Settings → Edge Functions

3. **Create New Function**
   - Click "Create a new function"
   - Name it: `generate-questions-from-context`

4. **Copy the Function Code**
   - Open `supabase/functions/generate-questions-from-context/index.ts`
   - Copy the entire contents
   - Paste it into the function editor in the dashboard

5. **Set Environment Variables**
   - Go to: Project Settings → Edge Functions → Secrets
   - Add a new secret:
     - Name: `GEMINI_API_KEY`
     - Value: Your Gemini API key

6. **Deploy**
   - Click "Deploy" or "Save" in the dashboard

## Option 2: Deploy via CLI (if you have access token)

If you have a Supabase access token:

1. **Set your access token** (in PowerShell):
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN="your-access-token-here"
   ```

2. **Link your project**:
   ```powershell
   npx supabase link --project-ref your-project-ref
   ```

3. **Deploy the function**:
   ```powershell
   npx supabase functions deploy generate-questions-from-context
   ```

## Option 3: Install Supabase CLI properly

For Windows, install via Scoop (recommended):

1. **Install Scoop** (if not already installed):
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```

2. **Install Supabase CLI**:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

3. **Then deploy**:
   ```powershell
   supabase login
   supabase link --project-ref your-project-ref
   supabase functions deploy generate-questions-from-context
   ```

## Getting Your Project Ref

1. Go to your Supabase Dashboard
2. Click on Project Settings (gear icon)
3. Your Project Reference ID is shown under "Reference ID"

## Getting Your Access Token

1. Go to https://app.supabase.com/account/tokens
2. Create a new token
3. Copy it (you won't be able to see it again)

---

**Recommended**: Use Option 1 (Dashboard) as it's the easiest and doesn't require CLI setup.

