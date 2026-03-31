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
    <div className="mt-4 px-4">
      <div className="grid grid-cols-4 gap-3">
        {menuItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => onMenuClick(item.id)}
            className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-2 group-hover:bg-white transition-colors">
              {item.icon}
            </div>
            <span className="text-[10px] text-slate-600 font-bold text-center leading-tight line-clamp-2">{item.label}</span>
            {item.value !== undefined && (
              <span className="text-[10px] text-indigo-600 font-black mt-1">₹{item.value}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
