-- PHENYX COLLECTIVE Waitlist Table Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Create the waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT,
  platforms TEXT[],
  why TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from anonymous users (for waitlist signups)
CREATE POLICY "Allow anonymous inserts" ON waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy to allow reads only for authenticated users (for admin dashboard)
-- Note: For the simple admin password approach, we allow anon reads
-- In production, you may want to use Supabase Auth for the admin
CREATE POLICY "Allow anonymous reads" ON waitlist
  FOR SELECT
  TO anon
  USING (true);

-- Create policy to allow updates from anonymous users (for step 2 of signup)
CREATE POLICY "Allow anonymous updates" ON waitlist
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Optional: Add a comment to the table
COMMENT ON TABLE waitlist IS 'Stores waitlist signups for PHENYX COLLECTIVE';

-- Create the newsletter table for "follow the build" signups
CREATE TABLE IF NOT EXISTS newsletter (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);

-- Enable Row Level Security (RLS)
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from anonymous users
CREATE POLICY "Allow anonymous inserts" ON newsletter
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy to allow reads for admin
CREATE POLICY "Allow anonymous reads" ON newsletter
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON TABLE newsletter IS 'Stores newsletter subscribers for PHENYX COLLECTIVE build updates';
