import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import Marketplace from "@/pages/Marketplace";
import ListingDetail from "@/pages/ListingDetail";
import CreateListing from "@/pages/CreateListing";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CRC from "@/pages/CRC";
import Dashboard from "@/pages/Dashboard";
import Trading from "@/pages/Trading";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/listings/:id" element={<ListingDetail />} />
            <Route path="/create" element={<CreateListing />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/crc" element={<CRC />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trading" element={<Trading />} />
          </Routes>
          <Toaster richColors position="top-right" toastOptions={{ style: { zIndex: 9999 } }} />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
