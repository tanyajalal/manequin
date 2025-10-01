const SUPABASE_URL = "https://dlqsdsktqjoebychjmwu.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscXNkc2t0cWpvZWJ5Y2hqbXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMTI1NTYsImV4cCI6MjA3NDU4ODU1Nn0.qcm3SIfQtAxShNw8I8Up0-oxwCZIJgYcUWdCmB39nfI"
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

;(async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error("Auth error:", error)
  } else {
    console.log("Session restored:", data)
    // Optionally close the tab or notify your extension
  }
})()
