'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';

interface PaymentStatusProps {
  className?: string;
}

export default function PaymentStatus({ className }: PaymentStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`);
      if (response.ok) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      setStatus('disconnected');
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge
        variant={status === 'connected' ? 'default' : status === 'disconnected' ? 'destructive' : 'secondary'}
        className="font-mono"
      >
        {status === 'connected' ? '🟢 Connected' :
         status === 'disconnected' ? '🔴 Disconnected' : '🟡 Checking...'}
      </Badge>
    </div>
  );
}