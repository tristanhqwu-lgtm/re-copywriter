import { useLocation, useNavigate } from "react-router-dom";
import { PenTool, Palette, Package, Sparkles, User } from "lucide-react";

const tabs = [
  { path: "/", label: "工作台", icon: PenTool },
  { path: "/styles", label: "風格", icon: Palette },
  { path: "/products", label: "產品", icon: Package },
  { path: "/scenes", label: "場景", icon: Sparkles },
  { path: "/profile", label: "我的", icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-brand-200/60 z-50">
      <div className="max-w-[430px] mx-auto flex">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] tracking-wider transition-colors ${
                active ? "text-brand" : "text-brand-300"
              }`}
            >
              <tab.icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
