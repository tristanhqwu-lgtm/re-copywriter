import { useLocation, useNavigate } from "react-router-dom";
import { PenTool, Palette, Package, Sparkles, User } from "lucide-react";

const tabs = [
  { path: "/", label: "工作台", icon: PenTool },
  { path: "/styles", label: "风格库", icon: Palette },
  { path: "/products", label: "产品库", icon: Package },
  { path: "/scenes", label: "场景库", icon: Sparkles },
  { path: "/profile", label: "我的", icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-[430px] mx-auto flex">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                active ? "text-brand" : "text-gray-400"
              }`}
            >
              <tab.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
