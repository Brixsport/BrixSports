'use client';

import { useState, useEffect } from 'react';
import { getPushService } from '@/lib/notifications/push-service';
import { Bell, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PushNotificationDebugger() {
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission | 'unknown';
    subscribed: boolean;
    vapidConfigured: boolean;
    serviceWorkerActive: boolean;
  }>({
    supported: false,
    permission: 'unknown',
    subscribed: false,
    vapidConfigured: false,
    serviceWorkerActive: false,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const pushService = getPushService();
    
    // Check support
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    
    // Check permission
    const permission = Notification.permission;
    
    // Check subscription
    const subscribed = await pushService.isSubscribed();
    
    // Check VAPID
    const vapidConfigured = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    
    // Check SW
    const registrations = await navigator.serviceWorker?.getRegistrations();
    const serviceWorkerActive = registrations?.some(r => r.active) || false;

    setStatus({
      supported,
      permission,
      subscribed,
      vapidConfigured,
      serviceWorkerActive,
    });
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const pushService = getPushService();
      const permission = await pushService.requestPermission();
      
      if (permission === 'granted') {
        toast.success('Notification permission granted!');
      } else if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
      }
      
      checkStatus();
    } catch (error) {
      toast.error('Failed to request permission');
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      const pushService = getPushService();
      // Use a test user ID or get from auth context
      const userId = 'test-user-' + Date.now();
      const result = await pushService.subscribe(userId);
      
      if (result) {
        toast.success('Successfully subscribed to push notifications!');
      } else {
        toast.error('Failed to subscribe');
      }
      
      checkStatus();
    } catch (error) {
      toast.error('Subscription failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'Push notifications are working! 🎉',
          type: 'test',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Test sent to ${result.sentTo} subscribers`);
      } else {
        toast.error(result.error || 'Failed to send test');
      }
    } catch (error) {
      toast.error('Test failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const StatusItem = ({ 
    label, 
    status, 
    good 
  }: { 
    label: string; 
    status: string; 
    good: boolean 
  }) => (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="flex items-center gap-2">
        {good ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400" />
        )}
        <span className={`text-sm font-semibold ${good ? 'text-green-400' : 'text-red-400'}`}>
          {status}
        </span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-md mx-auto bg-slate-900 rounded-xl shadow-lg border border-slate-800">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Push Notification Diagnostics</h2>
      </div>

      <div className="space-y-3 mb-6">
        <StatusItem 
          label="Browser Support" 
          status={status.supported ? 'Supported' : 'Not Supported'}
          good={status.supported}
        />
        <StatusItem 
          label="Permission" 
          status={status.permission}
          good={status.permission === 'granted'}
        />
        <StatusItem 
          label="Subscribed" 
          status={status.subscribed ? 'Yes' : 'No'}
          good={status.subscribed}
        />
        <StatusItem 
          label="VAPID Keys" 
          status={status.vapidConfigured ? 'Configured' : 'Missing'}
          good={status.vapidConfigured}
        />
        <StatusItem 
          label="Service Worker" 
          status={status.serviceWorkerActive ? 'Active' : 'Inactive'}
          good={status.serviceWorkerActive}
        />
      </div>

      <div className="space-y-2">
        {status.permission !== 'granted' && (
          <Button 
            onClick={requestPermission} 
            disabled={loading}
            className="w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            Request Permission
          </Button>
        )}

        {status.permission === 'granted' && !status.subscribed && (
          <Button 
            onClick={subscribe} 
            disabled={loading}
            className="w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            Subscribe to Notifications
          </Button>
        )}

        <Button 
          onClick={testNotification} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Send Test Notification
        </Button>

        <Button 
          onClick={checkStatus} 
          disabled={loading}
          variant="ghost"
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {!status.vapidConfigured && (
        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
          <p className="text-sm text-yellow-200">
            <strong>Missing VAPID Keys!</strong> Add these to your .env.local:
          </p>
          <code className="block mt-2 p-2 bg-slate-950 rounded text-xs text-slate-300">
            NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key<br/>
            VAPID_PRIVATE_KEY=your_private_key
          </code>
        </div>
      )}
    </div>
  );
}
