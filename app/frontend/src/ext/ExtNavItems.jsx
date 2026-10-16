import React from "react";
import { Sparkles } from "lucide-react";

// XL AI Studyo kenar cubugu girdileri. Sidebar.jsx'e tek DDYZ-FORK satiriyla baglanir.
export default function ExtNavItems({ activeTab, setActiveTab }) {
  return (
    <div
      className={`nav-item ${activeTab === "xl-studio" ? "active" : ""}`}
      onClick={() => setActiveTab("xl-studio")}
    >
      <Sparkles size={20} />
      <span>XL Studyo</span>
    </div>
  );
}
