# GTSE-CRM

## Local Environment setup

## 1. Create the Next.js + TypeScript + Tailwind app
npx create-next-app@latest gtse-crm --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd gtse-crm

## 2. Install Supabase SSR client, validation, charting, and icons
npm install @supabase/supabase-js @supabase/ssr zod recharts lucide-react

## 3. Initialize shadcn/ui (select default style, Zinc/Slate palette)
npx shadcn@latest init

npx shadcn@latest add button card table input label select badge dialog tabs

## 4. Initialize Supabase locally for database migrations
npm install -D supabase

npx supabase init