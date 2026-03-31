import { User, ChevronRight, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileHeaderProps {
  shortId: string;
  mobile: string;
  copied: boolean;
  setCopied: (copied: boolean) => void;
}

export default function ProfileHeader({ shortId, mobile, copied, setCopied }: ProfileHeaderProps) {
  const handleCopyId = () => {
    if (shortId && shortId !== 'Loading...' && shortId !== 'Error') {
      navigator.clipboard.writeText(shortId);
      setCopied(true);
      toast.success('UID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-5 bg-white flex items-center justify-between border-b border-slate-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100 shrink-0">
          <User className="w-7 h-7 text-indigo-500" />
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-slate-900 font-bold block text-sm truncate max-w-[150px]">UID: {shortId}</span>
            <button 
              onClick={handleCopyId}
              className="p-1 hover:bg-slate-100 rounded-md transition-colors shrink-0"
              title="Copy UID"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
          {mobile && <span className="text-slate-500 text-xs block mb-1">{mobile}</span>}
          <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-block">Reward: 4.5%</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
    </div>
  );
}
