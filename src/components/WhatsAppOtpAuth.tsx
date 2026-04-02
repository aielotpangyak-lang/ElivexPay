import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Phone, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { app } from '../firebase';

interface WhatsAppOtpAuthProps {
  onLogin?: () => void;
}

export function WhatsAppOtpAuth({ onLogin }: WhatsAppOtpAuthProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const functions = getFunctions(app);
  const auth = getAuth(app);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const maskPhone = (p: string) => {
    if (p.length !== 12) return p;
    return `${p.substring(0, 2)}******${p.substring(8)}`;
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 12 || !phone.startsWith('91')) {
      toast.error('Please enter a valid 12-digit number starting with 91');
      return;
    }

    setIsLoading(true);
    try {
      const requestOtpFn = httpsCallable(functions, 'requestWhatsAppOtp');
      await requestOtpFn({ phone });
      
      toast.success('OTP sent via WhatsApp!');
      setStep('otp');
      setCountdown(60); // 60s Server-side cooldown lock
      setOtp('');
    } catch (error: any) {
      console.error('Error requesting OTP:', error);
      const code = error.code || '';
      if (code === 'functions/resource-exhausted' || error.message.includes('Wait 60 seconds')) {
        toast.error('Please wait 60 seconds before requesting again.');
      } else {
        toast.error(error.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const verifyOtpFn = httpsCallable(functions, 'verifyWhatsAppOtp');
      const result = await verifyOtpFn({ phone, otp });
      
      const data = result.data as { success: boolean; token: string };
      
      if (data.success && data.token) {
        await signInWithCustomToken(auth, data.token);
        toast.success('Successfully logged in!');
        if (onLogin) onLogin();
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      
      // Standardized Error Mapping
      const code = error.code || '';
      const msg = error.message || '';
      
      if (code === 'functions/invalid-argument' || msg.includes('Invalid OTP')) {
        toast.error('Wrong OTP');
      } else if (code === 'functions/deadline-exceeded' || msg.includes('expired') || code === 'functions/not-found') {
        toast.error('OTP Expired');
        setStep('phone');
        setCountdown(0);
      } else if (code === 'functions/resource-exhausted' || msg.includes('Too many tries')) {
        toast.error('Too many tries. Please request a new OTP.');
        setStep('phone');
        setCountdown(0);
      } else {
        toast.error(msg || 'Verification failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        WhatsApp Login
      </h2>
      
      {step === 'phone' ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="tel"
                placeholder="91XXXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="pl-10"
                maxLength={12}
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Include 91 country code without +</p>
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={isLoading || phone.length !== 12 || countdown > 0}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : countdown > 0 ? `Wait ${countdown}s` : 'Send WhatsApp OTP'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600">Enter the OTP sent to</p>
            <p className="font-semibold text-gray-800">{maskPhone(phone)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit OTP</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="pl-10 text-center tracking-widest text-lg"
                maxLength={6}
                required
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">
                OTP is valid for 2 minutes
              </p>
              <button 
                type="button" 
                onClick={() => setStep('phone')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Change Number
              </button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={isLoading || otp.length !== 6}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
          </Button>

          <Button 
            type="button" 
            variant="outline"
            className="w-full mt-2"
            onClick={handleRequestOtp}
            disabled={isLoading || countdown > 0}
          >
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </Button>
        </form>
      )}
    </div>
  );
}
