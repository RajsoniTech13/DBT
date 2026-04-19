"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "DFO" | "VERIFIER" | "AUDITOR";
  district: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Rehydrate user session from cookies on mount
    const storedToken = Cookies.get("token");
    const storedUserStr = Cookies.get("user");
    
    if (storedToken && storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr) as User;
        setToken(storedToken);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse stored user session", e);
        Cookies.remove("token");
        Cookies.remove("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, authToken: string) => {
    Cookies.set("token", authToken, { expires: 1, path: "/" }); 
    Cookies.set("user", JSON.stringify(userData), { expires: 1, path: "/" });
    setUser(userData);
    setToken(authToken);
    
    // Auto-route to corresponding dashboard based on role mappings
    const roleRoutes: Record<string, string> = {
      "ADMIN": "admin",
      "DFO": "dfo",
      "VERIFIER": "verifier",
      "AUDITOR": "audit"
    };
    
    const targetRoute = roleRoutes[userData.role] || "dfo";
    router.push(`/dashboard/${targetRoute}`);
  };

  const logout = () => {
    Cookies.remove("token", { path: "/" });
    Cookies.remove("user", { path: "/" });
    setUser(null);
    setToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
