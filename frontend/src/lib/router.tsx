import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { validateRedirectUrl, validatePasswordRecoveryRedirect } from "./redirect";

export { validateRedirectUrl, validatePasswordRecoveryRedirect };

/**
 * Lightweight, zero-dependency client-side router built on the native browser History API.
 * Adheres strictly to DocuMind accessibility and reduced-motion invariants.
 */

export interface RouterContextType {
  pathname: string;
  search: string;
  hash: string;
  navigate: (href: string) => void;
  getQueryParam: (key: string) => string | null;
}

const RouterContext = createContext<RouterContextType>({
  pathname: typeof window !== "undefined" ? window.location.pathname : "/",
  search: typeof window !== "undefined" ? window.location.search : "",
  hash: typeof window !== "undefined" ? window.location.hash : "",
  navigate: () => {},
  getQueryParam: () => null,
});

export const useRouter = () => useContext(RouterContext);

export const usePathname = (): string => {
  const { pathname } = useContext(RouterContext);
  return pathname;
};

export const useSearch = (): string => {
  const { search } = useContext(RouterContext);
  return search;
};

/**
 * Programmatic client-side navigation respecting prefers-reduced-motion.
 */
export function navigate(href: string) {
  if (typeof window === "undefined") return;
  const currentFullUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentFullUrl === href) return;

  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
}

export interface RouterProviderProps {
  children: React.ReactNode;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [locationState, setLocationState] = useState(() => ({
    pathname: typeof window !== "undefined" ? window.location.pathname : "/",
    search: typeof window !== "undefined" ? window.location.search : "",
    hash: typeof window !== "undefined" ? window.location.hash : "",
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNavigate = useCallback((href: string) => {
    navigate(href);
  }, []);

  const getQueryParam = useCallback(
    (key: string): string | null => {
      if (typeof window === "undefined") return null;
      try {
        const params = new URLSearchParams(locationState.search);
        return params.get(key);
      } catch (_) {
        return null;
      }
    },
    [locationState.search]
  );

  return (
    <RouterContext.Provider
      value={{
        pathname: locationState.pathname,
        search: locationState.search,
        hash: locationState.hash,
        navigate: handleNavigate,
        getQueryParam,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  activeClassName?: string;
  children: React.ReactNode;
}

/**
 * Accessible Link component supporting native modifier keys (Cmd/Ctrl/Shift + Click)
 * for opening in new tabs while performing client-side pushState navigation for normal clicks.
 */
export const Link: React.FC<LinkProps> = ({
  href,
  activeClassName,
  className = "",
  children,
  onClick,
  ...rest
}) => {
  const { pathname, navigate: routerNavigate } = useContext(RouterContext);
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (onClick) {
      onClick(e);
    }

    // Preserve native browser behavior for modified clicks (Cmd/Ctrl/Shift/Alt or middle-click)
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0 ||
      rest.target === "_blank"
    ) {
      return;
    }

    e.preventDefault();
    routerNavigate(href);
  }

  const combinedClassName = `${className} ${isActive && activeClassName ? activeClassName : ""}`.trim();

  return (
    <a
      href={href}
      onClick={handleClick}
      className={combinedClassName}
      aria-current={isActive ? "page" : undefined}
      {...rest}
    >
      {children}
    </a>
  );
};
