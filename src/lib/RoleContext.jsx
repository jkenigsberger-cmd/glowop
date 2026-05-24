import React, { createContext, useState, useEffect, useContext } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export const RoleContext = createContext({
  role: null,
  internalUser: null,
  isLoadingRole: true,
  roleError: null, // null | "not_found" | "inactive"
});

export function RoleProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [role, setRole] = useState(null);
  const [internalUser, setInternalUser] = useState(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [roleError, setRoleError] = useState(null);

  useEffect(() => {
    // Skip for public guest-form route
    if (window.location.pathname === "/guest-form") {
      setIsLoadingRole(false);
      return;
    }

    if (isLoadingAuth) return;

    if (!isAuthenticated || !user?.email) {
      // Not authenticated — stop loading, don't call backend
      setRole(null);
      setRoleError(null);
      setIsLoadingRole(false);
      return;
    }

    loadRole(user.email);
  }, [isAuthenticated, isLoadingAuth, user]);

  const loadRole = async (email) => {
    setIsLoadingRole(true);
    const normalizedEmail = email.trim().toLowerCase();
    console.log("[ROLE DEBUG] auth user email:", normalizedEmail);
    try {
      // Use backend function with service role to bypass row-level security
      const res = await base44.functions.invoke('getMyInternalUser', {});
      const data = res.data;
      console.log("[ROLE DEBUG] getMyInternalUser response:", data);

      if (!data.found) {
        console.log("[ROLE DEBUG] not_found for email:", normalizedEmail);
        setRoleError("not_found");
        setRole(null);
        setInternalUser(null);
      } else if (!data.active) {
        setRoleError("inactive");
        setRole(null);
        setInternalUser(data);
      } else {
        setRoleError(null);
        setRole(data.role);
        setInternalUser(data);
        console.log("[ROLE DEBUG] role set to:", data.role);
      }
    } catch (err) {
      console.error("Failed to load internal user role:", err);
      setRoleError("not_found");
      setRole(null);
      setInternalUser(null);
    } finally {
      setIsLoadingRole(false);
    }
  };

  const refreshRole = () => {
    if (user?.email) loadRole(user.email);
  };

  return (
    <RoleContext.Provider value={{ role, internalUser, isLoadingRole, roleError, refreshRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  return useContext(RoleContext);
}