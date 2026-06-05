/**
 * Vitest setup file
 * Runs before all tests to initialize test environment
 */

import { config } from "dotenv";
import path from "path";

// Load .env file for tests
config({ path: path.resolve(process.cwd(), ".env") });

// Override with local Supabase for tests
// Tests should always run against local instance
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_KEY =
  process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Force local Supabase for tests
process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
process.env.SUPABASE_KEY = LOCAL_SUPABASE_KEY;

console.log("✓ Test environment initialized");
console.log(`  Supabase URL: ${process.env.SUPABASE_URL}`);
