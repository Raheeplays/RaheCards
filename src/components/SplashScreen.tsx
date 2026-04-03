import React, { useEffect } from 'react';
import { motion } from 'motion/react';

export default function SplashScreen({ onComplete }: { key?: string; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-[#0f1419] flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        {/* Rounded Diamond Logo */}
        <div className="w-24 h-24 border-4 border-rahee rounded-[20%] rotate-45 mb-12 shadow-[0_0_30px_rgba(50,130,190,0.3)]" />
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold text-white tracking-tight mb-3">
            Rahee Cards
          </h1>
          <p className="text-zinc-500 text-lg font-medium">
            The strategic trading card game
          </p>
        </motion.div>
      </motion.div>
      
      {/* Subtle loading indicator at bottom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden"
      >
        <motion.div 
          animate={{ x: [-200, 200] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-rahee"
        />
      </motion.div>
    </div>
  );
}
