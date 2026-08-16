import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import App from "./App.jsx";

export default function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError("");
    setInfo("");
    if (!email || !password) { setError("Enter an email and password."); return; }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };

  if (loading) return null;

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F6FB", fontFamily: "system-ui, sans-serif", padding: 16, boxSizing: "border-box" }}>
        <div style={{ width: "100%", maxWidth: 340, background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 8px 24px rgba(16,24,40,0.08)" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#1F2430" }}>Finance Tracker</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#8A8FA3" }}>
            {mode === "signin" ? "Sign in to sync your data across devices." : "Create an account to sync across devices."}
          </p>
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} />
          {error && <div style={{ color: "#EF4444", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          {info && <div style={{ color: "#16A34A", fontSize: 12.5, marginBottom: 10 }}>{info}</div>}
          <button onClick={submit} disabled={busy} style={btnStyle}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }} style={linkStyle}>
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "fixed", top: 10, right: 14, zIndex: 50 }}>
        <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 11.5, background: "#fff", border: "1px solid #ECEAF3", borderRadius: 999, padding: "6px 12px", cursor: "pointer", color: "#8A8FA3", fontWeight: 600 }}>
          Sign out
        </button>
      </div>
      <App />
    </div>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #ECEAF3", fontSize: 14, outline: "none" };
const btnStyle = { width: "100%", background: "#FF7A3D", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", marginBottom: 8 };
const linkStyle = { width: "100%", background: "none", border: "none", color: "#FF7A3D", fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 4 };
