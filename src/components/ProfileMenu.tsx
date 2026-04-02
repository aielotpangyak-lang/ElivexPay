import React from 'react';
import { ChevronRight } from 'lucide-react';

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
}

interface ProfileMenuProps {
  menuItems: MenuItem[];
  onMenuClick: (id: string) => void;
}

export default function ProfileMenu({ menuItems, onMenuClick }: ProfileMenuProps) {
  return (
    <div className="mt-4 px-4 space-y-3">
      {menuItems.map((item) => (
        <button 
          key={item.id} 
          onClick={() => onMenuClick(item.id)}
          className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-white transition-colors">
              {item.icon}
            </div>
            <div className="text-left">
              <span className="text-sm text-slate-800 font-bold block">{item.label}</span>
              {item.value !== undefined && (
                <span className="text-xs text-indigo-600 font-black">₹{item.value}</span>
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </button>
      ))}
    </div>
  );
}
