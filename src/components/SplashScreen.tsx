import { motion } from 'motion/react';
import Logo from './Logo';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white z-[1000] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full -mr-48 -mt-48 blur-[100px] opacity-60 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50 rounded-full -ml-48 -mb-48 blur-[100px] opacity-60 animate-pulse delay-700"></div>
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-24 h-24 mb-6 relative">
          <div className="absolute inset-0 bg-indigo-600/10 rounded-[2rem] blur-xl animate-pulse"></div>
          <Logo className="w-full h-full relative z-10" />
        </div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl font-black text-slate-900 tracking-tighter mb-2"
        >
          ELiveXPay
        </motion.h1>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mb-8">
            Premium E-Coin Exchange
          </p>
          
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="w-2 h-2 bg-indigo-600 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-12 text-slate-300 font-bold text-[10px] uppercase tracking-widest"
      >
        Secure • Instant • Reliable
      </motion.div>
    </div>
  );
}
