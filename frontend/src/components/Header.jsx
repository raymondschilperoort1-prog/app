import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Sprout, MessageSquare, LayoutDashboard, LogOut, Store, Coins } from "lucide-react";

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const link = (to, label) => (
    <Link
      to={to}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${
        loc.pathname === to ? "text-brand bg-bg-alt" : "text-ink-secondary hover:text-ink-primary"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-bg-base/95 backdrop-blur-sm border-b border-edge">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-brand flex items-center justify-center">
            <Sprout className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <span className="font-display text-xl font-bold text-ink-primary">CottonHub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {link("/marketplace", "Marketplace")}
          {link("/crc", "CRC Token")}
          {user && link("/dashboard", "Dashboard")}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                data-testid="header-chat-btn"
                variant="ghost"
                size="sm"
                onClick={() => navigate("/chat")}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" /> Chat
              </Button>
              <Button
                data-testid="header-create-listing-btn"
                size="sm"
                onClick={() => navigate("/create")}
                className="bg-brand hover:bg-brand-hover text-white gap-2"
              >
                <Store className="h-4 w-4" /> Sell
              </Button>
              <Button
                data-testid="header-logout-btn"
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="text-ink-muted"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                data-testid="header-login-btn"
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
              >
                Log in
              </Button>
              <Button
                data-testid="header-register-btn"
                size="sm"
                onClick={() => navigate("/register")}
                className="bg-brand hover:bg-brand-hover text-white"
              >
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
