# 🗳️ SRC Voting App
### Nigerian School Student Representative Council Election System

A full-featured, secure digital voting application built with **Next.js 14** and **Supabase**.

---

## ✨ Features

### Student Portal
- Secure email + password login
- Vote for all positions in a single session
- Beautiful candidate cards with photos
- Progress indicator across positions
- One vote per student enforcement

### Admin Portal
- Dashboard with live statistics & voter turnout
- Open/Close voting with one click
- Manage election name and school name
- Add positions (President, VP, Secretary, etc.)
- Add candidates with photos, class, and manifesto
- Manage student emails (add, remove, bulk import)
- View results with visual vote bars & winner highlights
- Export results as CSV

---

## 🚀 Setup Guide

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to provision

### Step 2: Run the Database Schema
1. In Supabase Dashboard → **SQL Editor**
2. Paste the contents of `supabase_schema.sql` and run it

### Step 3: Create Storage Bucket
1. In Supabase Dashboard → **Storage** → **New Bucket**
2. Name it exactly: `candidates`
3. Toggle it to **Public**
4. Click Create

### Step 4: Add an Increment Vote Function
In the SQL Editor, run this:
```sql
CREATE OR REPLACE FUNCTION increment_vote(candidate_id UUID)
RETURNS VOID AS $$
  UPDATE candidates SET vote_count = vote_count + 1 WHERE id = candidate_id;
$$ LANGUAGE SQL;
```

### Step 5: Set Up Admin User
1. In Supabase Dashboard → **Authentication** → **Users** → **Invite user**
2. Enter your admin email address
3. The admin will receive an email to set their password

### Step 6: Set Up Student Users
For each student who needs to vote, you need to create their Supabase auth account.

**Option A (Manual):** Invite each student via Supabase Auth → Users → Invite user

**Option B (Bulk - Recommended):** Use the Supabase service role key to create users programmatically, OR enable email signups and have students register with their school emails.

> **Tip:** For a school setting, the easiest flow is:
> 1. Enable "Allow new users to sign up" in Auth settings
> 2. Students sign up with their school email
> 3. Their email gets added to the students table by admin
> 4. Only students in the students table can vote

### Step 7: Configure Environment Variables
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_EMAIL=admin@yourschool.edu.ng
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in: Supabase Dashboard → Project Settings → API

### Step 8: Install & Run
```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### Step 9: Deploy (Optional)
Deploy to [Vercel](https://vercel.com) for free:
```bash
npm install -g vercel
vercel
```
Add your environment variables in Vercel's dashboard.

---

## 📁 Project Structure
```
src-voting/
├── app/
│   ├── login/           # Login page
│   ├── vote/            # Student voting portal
│   ├── admin/
│   │   ├── dashboard/   # Admin overview
│   │   ├── positions/   # Manage positions & candidates
│   │   ├── students/    # Manage student emails
│   │   └── results/     # View & export results
│   └── api/vote/        # Secure vote submission endpoint
├── lib/
│   ├── supabase.ts      # Browser client
│   ├── supabase-server.ts  # Server client + admin client
│   └── types.ts         # TypeScript types
├── middleware.ts         # Route protection
└── supabase_schema.sql  # Database schema
```

---

## 🔒 Security
- Students can only vote once (enforced server-side)
- Admin actions use service role key (never exposed to client)
- Route middleware prevents unauthorized access
- Votes are anonymous (not linked to student in a recoverable way)

---

## 🎨 Design
Deep emerald green & gold palette inspired by Nigerian elegance.
Typography: Cormorant Garamond (display) + DM Sans (body).
# Voting-App  
