import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ShieldAlert } from 'lucide-react';

interface AuthScreenProps {
  key?: string;
  onLogin: (name: string, key: string) => void;
  onSignup: (name: string, key: string) => void;
  error: string | null;
  loading: boolean;
}

export default function AuthScreen({ onLogin, onSignup, error, loading }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [authLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const adminKeys = ['786', 'aiza', '181855', 'rahee', 'admin'];
    if (isLogin && name.toLowerCase() === 'rahee' && adminKeys.includes(key.toLowerCase())) {
      if (!showOtp) {
        setShowOtp(true);
        return;
      }
      
      if (otp !== '181855') {
        setOtpError('Invalid Admin OTP');
        return;
      }
    }

    if (isLogin) {
      onLogin(name, key);
    } else {
      onSignup(name, key);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-4 bg-[#0f1419]"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[400px] bg-[#151a21] border border-white/5 p-10 rounded-2xl shadow-2xl flex flex-col items-center"
      >
        {/* Logo Section */}
        <div className="w-16 h-16 border-4 border-rahee rounded-[20%] rotate-45 mb-6 shadow-[0_0_20px_rgba(50,130,190,0.2)]" />
        
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-rahee mb-2">
            Rahee Cards
          </h2>
          <p className="text-zinc-400 text-sm">
            {isLogin 
              ? 'Enter your Player Name and Rahee Key to login' 
              : 'Create your Player Name and Rahee Key to join'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {!showOtp ? (
            <>
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-3.5 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors"
                  placeholder="Player Name"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="password"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-3.5 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors"
                  placeholder="Rahee Key"
                />
              </div>
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="bg-rahee/10 border border-rahee/20 rounded-lg p-4 mb-4">
                <p className="text-rahee text-xs font-bold uppercase tracking-widest text-center">
                  Admin Verification Required
                </p>
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-3.5 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="OTP"
                  maxLength={6}
                />
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowOtp(false);
                  setOtp('');
                }}
                className="w-full text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Back to Login
              </button>
            </motion.div>
          )}

          {(error || otpError) && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {otpError || error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full bg-rahee hover:bg-rahee/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 shadow-lg shadow-rahee/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (showOtp ? 'Verify Admin' : (isLogin ? 'Login' : 'Sign Up'))}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-zinc-400 text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-white hover:text-rahee transition-colors font-medium underline underline-offset-4"
            >
              {isLogin ? "Sign up" : "Login"}
            </button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
