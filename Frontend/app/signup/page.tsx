"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Shield, User, ArrowRight, ClipboardList, MapPin, SearchCode, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-sm transition-colors focus-within:border-emerald-400 focus-within:bg-emerald-500/5">
    {children}
  </div>
);

const PrimaryButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={
      "rounded-full px-5 py-3 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
      "bg-emerald-900 text-white hover:bg-emerald-800 focus:ring-emerald-700 " +
      className
    }
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={
      "rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none " +
      "text-slate-700 hover:bg-slate-100 " +
      className
    }
    {...props}
  >
    {children}
  </button>
);

const CustomCheckbox = ({ name, label }: { name: string; label: string }) => (
  <label className="group flex items-center gap-3 cursor-pointer select-none">
    <div className="relative flex items-center justify-center">
      <input
        type="checkbox"
        name={name}
        className="peer h-5 w-5 appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-emerald-600 checked:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      <svg
        className="absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <span className="text-sm font-medium text-slate-600 transition-colors group-hover:text-slate-900">
      {label}
    </span>
  </label>
);

type Role = "dfo" | "verifier" | "audit" | "admin";

const RoleToggle = ({ role, setRole }: { role: Role; setRole: (r: Role) => void }) => (
  <div className="mx-auto mb-2 flex w-fit items-center gap-1 bg-slate-100 p-1 rounded-full shadow-inner overflow-x-auto max-w-full no-scrollbar">
    <button
      onClick={() => setRole("dfo")}
      className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        role === "dfo" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <ClipboardList className="h-3.5 w-3.5" />
      DFO
    </button>
    <button
      onClick={() => setRole("verifier")}
      className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        role === "verifier" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <MapPin className="h-3.5 w-3.5" />
      Verifier
    </button>
    <button
      onClick={() => setRole("audit")}
      className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        role === "audit" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <SearchCode className="h-3.5 w-3.5" />
      Audit
    </button>
    <button
      onClick={() => setRole("admin")}
      className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        role === "admin" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <Shield className="h-3.5 w-3.5" />
      Admin
    </button>
  </div>
);

export default function SignupPage() {
  const [role, setRole] = useState<Role>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    // Attach the selected role and default district empty or placeholder
    const payload = {
      ...data,
      role: role.toUpperCase(),
      district: data.district || "Default District" // If district field doesn't exist, provide a mock placeholder
    };
    
    try {
      const res = await api.post('/auth/register', payload);
      if (res.success) {
        alert("Account Created successfully! You can now sign in.");
        router.push("/login");
      } else {
        setError(res.error || "Failed to create account.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    console.log("Continue with Google clicked");
    alert("Continue with Google clicked");
  };

  const handleSignIn = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      <nav className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-6 md:px-0">
        <div className="flex items-center gap-3" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">DBT Guard</span>
        </div>
        <div className="hidden gap-2 md:flex">
          <SecondaryButton onClick={() => window.location.href = '/login'}>Sign In</SecondaryButton>
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-6 px-4 pb-14 md:grid-cols-2 md:px-0">
        <div className="flex flex-col justify-center space-y-8 pr-2">
          <div>
            <h1 className="text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight text-slate-900 font-jakarta">
              Create your account.
            </h1>
            <p className="mt-4 max-w-md text-slate-600">
              Join DBT Guard and start monitoring welfare leakage across Gujarat's DBT schemes.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Real-time detection</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Prioritized queues</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Risk heatmaps</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
            <RoleToggle role={role} setRole={setRole} />

            <div className="relative overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={role}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="w-full"
                >
                  <div className="mt-6 mb-3 flex items-center gap-2">
                    {role === "dfo" && (
                      <><ClipboardList className="h-5 w-5 text-emerald-600" /><span className="text-lg font-semibold text-slate-900">DFO Registration</span></>
                    )}
                    {role === "verifier" && (
                      <><MapPin className="h-5 w-5 text-emerald-600" /><span className="text-lg font-semibold text-slate-900">Verifier Registration</span></>
                    )}
                    {role === "audit" && (
                      <><SearchCode className="h-5 w-5 text-emerald-600" /><span className="text-lg font-semibold text-slate-900">Audit Registration</span></>
                    )}
                    {role === "admin" && (
                      <><Shield className="h-5 w-5 text-emerald-600" /><span className="text-lg font-semibold text-slate-900">Admin Registration</span></>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
                    {role === "dfo" && "Join as a District Finance Officer to manage local DBT investigation pipelines."}
                    {role === "verifier" && "Register as a Field Verifier to conduct on-site physical review visits."}
                    {role === "audit" && "Join the audit team to query cross-scheme leakage and systemic anomalies."}
                    {role === "admin" && "Authorized state-level access for rule configuration and statewide heatmaps."}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <form className="space-y-6" onSubmit={handleSignUp}>
              <div>
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <div className="mt-2">
                  <GlassInputWrapper>
                    <input
                      name="name"
                      type="text"
                      placeholder="Enter your full name"
                      className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-slate-900 placeholder:text-slate-400"
                    />
                  </GlassInputWrapper>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <div className="mt-2">
                  <GlassInputWrapper>
                    <input
                      name="email"
                      type="email"
                      placeholder={role === "admin" ? "Enter your official email" : "Enter your email"}
                      className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-slate-900 placeholder:text-slate-400"
                    />
                  </GlassInputWrapper>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="mt-2">
                  <GlassInputWrapper>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-slate-900 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                        ) : (
                          <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                        )}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <CustomCheckbox name="terms" label="I agree to the terms" />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
                  {error}
                </motion.div>
              )}

              <PrimaryButton 
                type="submit" 
                className="w-full flex items-center justify-center gap-2 group py-3.5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Create {role.toUpperCase()} Account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </PrimaryButton>
            </form>

            <div className="relative flex items-center justify-center py-6">
              <span className="w-full border-t border-slate-200"></span>
              <span className="px-4 text-sm text-slate-500 bg-white absolute">Or continue with</span>
            </div>

            <button
              onClick={handleGoogleSignUp}
              className="w-full flex items-center justify-center gap-3 rounded-full border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSignIn();
                }}
                className="text-emerald-700 font-medium hover:text-emerald-800 transition-colors"
              >
                Sign In
              </a>
            </p>
          </div>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-6 text-center text-xs text-slate-400 md:px-0">
        © {new Date().getFullYear()} DBT Guard - Gujarat Leakage Detection System. All rights reserved.
      </footer>
    </div>
  );
}