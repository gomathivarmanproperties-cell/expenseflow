"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Clear Firebase auth
      await signOut(auth);
      
      // Clear session cookie
      await fetch('/api/auth/session', {
        method: 'DELETE',
      });
      
      // Clear user state
      setUser(null);
      
      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
    >
      <LogOut size={16} />
      <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
    </button>
  );
}
