// src/routes/Database.jsx
import { useLocation } from "react-router-dom";
import Settings from "./Settings";

export default function Database() {
  const location = useLocation();
  
  // Determine active tab from URL
  const activeTab = location.pathname.split('/')[2] || 'products';

  // Simply use the existing Settings component
  // The Settings component will handle showing the appropriate content based on the URL
  return <Settings />;
}

