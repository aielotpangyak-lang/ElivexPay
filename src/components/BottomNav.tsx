import { Home, ShoppingCart, CheckCircle2, Users, User } from 'lucide-react';

type Tab = 'home' | 'buy' | 'upi' | 'team' | 'mine';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: <Home className="w-6 h-6" /> },
    { id: 'buy', label: 'Buy', icon: <ShoppingCart className="w-6 h-6" /> },
    { id: 'upi', label: 'UPI', icon: <CheckCircle2 className="w-6 h-6" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-6 h-6" /> },
    { id: 'mine', label: 'Mine', icon: <User className="w-6 h-6" /> },
  ] as const;

  return (
    <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 pb-safe pt-2 px-4 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-200 ${
              isActive ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`mb-1 transition-transform duration-200 ${isActive ? '-translate-y-1' : ''}`}>
              {item.icon}
            </div>
            <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold opacity-100' : 'font-medium opacity-80'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
