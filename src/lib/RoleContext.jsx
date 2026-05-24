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
      setIsLoadingRole(false);
      return;
    }

    loadRole(user.email);
  }, [isAuthenticated, isLoadingAuth, user]);

  const loadRole = async (email) => {
    setIsLoadingRole(true);
    try {
      const results = await base44.entities.InternalUser.filter({ email });
      if (!results || results.length === 0) {
        setRoleError("not_found");
        setRole(null);
        setInternalUser(null);
      } else {
        const iu = results[0];
        if (!iu.active) {
          setRoleError("inactive");
          setRole(null);
          setInternalUser(iu);
        } else {
          setRoleError(null);
          setRole(iu.role);
          setInternalUser(iu);
        }
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