import React, { useState, useEffect, createContext, useContext, useCallback } from "react";

/**
 * Lightweight, zero-dependency client-side router built on the native browser History API.
 * Adheres strictly to DocuMind accessibility and reduced-motion invariants.
 */

interface RouterContextType {
  pathname: string;
  navigate: (href: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  pathname: typeof window !== "undefined" ? window.location.pathname : "/",
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);

export const usePathname = (): string => {
  const { pathname } = useContext(RouterContext);
  return pathname;
};

/**
 * Programmatic client-side navigation respecting prefers-reduced-motion.
 */
export function navigate(href: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;

  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
}

export interface RouterProviderProps {
  children: React.ReactNode;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(() => {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setPathname(window.location.pathname);
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNavigate = useCallback((href: string) => {
    navigate(href);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname, navigate: handleNavigate }}>
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
