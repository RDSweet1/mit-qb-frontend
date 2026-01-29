# MIT Consulting - QuickBooks Timesheet System Frontend

Modern Next.js 14 application with Microsoft Entra ID (Azure AD) authentication for managing timesheets, reports, and invoices integrated with QuickBooks Online.

## Features

- **Microsoft SSO**: Secure authentication using Azure AD / Microsoft Entra ID
- **Time Entry Management**: View and sync time entries from QuickBooks Workforce
- **Weekly Reports**: Generate and email weekly time summaries to clients
- **Invoice Creation**: Create monthly invoices directly in QuickBooks Online
- **Real-time Dashboard**: Monitor QuickBooks connection and billing status
- **Responsive Design**: Beautiful UI with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: @azure/msal-react (Microsoft Authentication Library)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy the template and fill in your credentials:

```bash
cp .env.local.template .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://migcpasmtbdojqphqyzc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Azure AD / Microsoft Entra ID
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-app-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-azure-tenant-id

# Redirect URI (update after deploying)
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
```

### 3. Azure AD Configuration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Create a new registration or use existing app
4. Add redirect URI: `http://localhost:3000` (for development)
5. Add API permissions:
   - Microsoft Graph API:
     - `User.Read`
     - `Mail.Send`
     - `email`
     - `profile`
     - `openid`
6. Copy the **Application (client) ID** and **Directory (tenant) ID**

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx            # Root layout with AuthProvider
│   ├── page.tsx              # Home/Dashboard page
│   ├── time-entries/
│   │   └── page.tsx          # Time entries view & sync
│   ├── reports/
│   │   └── page.tsx          # Weekly report generation
│   ├── invoices/
│   │   └── page.tsx          # Monthly invoice creation
│   └── settings/
│       └── page.tsx          # QuickBooks & system settings
├── components/
│   └── AuthProvider.tsx      # MSAL authentication wrapper
├── lib/
│   ├── authConfig.ts         # MSAL configuration
│   └── supabaseClient.ts     # Supabase client & helpers
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Key Pages

### Dashboard (`/`)
- Authentication with Microsoft SSO
- Navigation to all main features
- Quick stats (connection status, recent activity)

### Time Entries (`/time-entries`)
- View all time entries from QuickBooks
- Sync button to fetch latest data
- Filter by employee, customer, date range

### Weekly Reports (`/reports`)
- Select week to generate reports
- Send email summaries to all customers
- View report history

### Invoices (`/invoices`)
- Select billing month
- Create invoices in QuickBooks Online
- View creation status and errors

### Settings (`/settings`)
- QuickBooks connection status
- Database configuration
- Automation schedules
- Email delivery settings

## API Integration

### Supabase Edge Functions

The frontend calls these Edge Functions:

- **`qb-time-sync`**: Sync time entries from QuickBooks
- **`send-reminder`**: Send weekly reports via email
- **`create-invoices`**: Generate monthly invoices
- **`connect-qb`**: OAuth connection to QuickBooks
- **`sync-service-items`**: Update billing rates

Example API call:

```typescript
import { callEdgeFunction } from '@/lib/supabaseClient';

const result = await callEdgeFunction('qb-time-sync', {
  action: 'sync',
  startDate: '2026-01-01',
  endDate: '2026-01-31'
});
```

## Authentication Flow

1. User clicks "Sign in with Microsoft"
2. MSAL popup opens with Azure AD login
3. User authenticates with Microsoft account
4. Access token stored in session storage
5. User redirected to dashboard

## Deployment

### Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add frontend"
   git push origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Set root directory to `frontend/`
   - Add environment variables (`.env.local` contents)
   - Click "Deploy"

3. **Update Azure AD:**
   - Add production URL as redirect URI in Azure Portal
   - Update `NEXT_PUBLIC_REDIRECT_URI` in Vercel environment variables

### Environment Variables in Vercel

Add these in **Vercel Dashboard** > **Settings** > **Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_AZURE_CLIENT_ID
NEXT_PUBLIC_AZURE_TENANT_ID
NEXT_PUBLIC_REDIRECT_URI
```

## Security

- **Authentication**: Microsoft Entra ID (Azure AD) SSO
- **Authorization**: Row-level security in Supabase
- **Data Encryption**: TLS 1.3 for all API calls
- **No Credentials Stored**: OAuth tokens handled by MSAL
- **HTTPS Only**: Required in production

## Development Tips

### Hot Reload
Next.js automatically reloads when you save files.

### TypeScript Errors
```bash
npm run lint
```

### Build for Production
```bash
npm run build
npm start
```

### Clear Cache
```bash
rm -rf .next node_modules
npm install
npm run dev
```

## Troubleshooting

### "Failed to authenticate"
- Check Azure AD app registration
- Verify client ID and tenant ID
- Ensure redirect URI matches

### "Failed to load time entries"
- Check Supabase URL and anon key
- Verify Edge Functions are deployed
- Check browser console for errors

### "CORS error"
- Ensure Supabase CORS settings allow your domain
- Check Edge Function response headers

## Support

For issues or questions:
- Email: accounting@mitigationconsulting.com
- Phone: 813-962-6855

## License

Internal use only - MIT Consulting © 2026
