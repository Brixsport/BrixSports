'use client';

import { useState, useEffect } from 'react';
import { getPushService } from '@/lib/notifications/push-service';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PushNotificationDebugger() {
  const { user, isAuthenticated } = useAuth();
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
  const [mobileInfo, setMobileInfo] = useState<{
    isMobile: boolean;
    isPWAInstalled: boolean;
    userAgent: string;
  }>({
    isMobile: false,
    isPWAInstalled: false,
    userAgent: '',
  });

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
    
    // Mobile-specific checks
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isPWAInstalled = !!(navigator as any).standalone || isStandalone;

    setMobileInfo({
      isMobile,
      isPWAInstalled,
      userAgent: navigator.userAgent,
    });

    setStatus({
      supported,
      permission,
      subscribed,
      vapidConfigured,
      serviceWorkerActive,
    });
    
    // Log mobile-specific info
    console.log('[PushDebugger] Mobile Info:', {
      isMobile,
      isPWAInstalled,
      userAgent: navigator.userAgent,
      standalone: (navigator as any).standalone,
      displayMode: isStandalone ? 'standalone' : 'browser'
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
      
      // Get user ID from AuthContext
      if (!isAuthenticated || !user?.id) {
        toast.error('You must be logged in to subscribe to push notifications');
        console.error('[PushDebugger] No user logged in - subscription requires a valid user ID');
        setLoading(false);
        return;
      }
      
      const userId = user.id;
      console.log('[PushDebugger] Using authenticated userId:', userId);
      
      const result = await pushService.subscribe(userId);
      
      if (result) {
        toast.success('Successfully subscribed to push notifications!');
      } else {
        toast.error('Failed to subscribe - check console for details');
      }
      
      checkStatus();
    } catch (error) {
      toast.error('Subscription failed: ' + (error as Error).message);
      console.error('[PushDebugger] Subscribe error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testServiceWorker = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        toast.error('No service worker registration found');
        return;
      }
      
      if (!registration.active) {
        toast.error('Service worker not active');
        return;
      }
      
      console.log('[PushDebugger] Service Worker Info:', {
        scope: registration.scope,
        state: registration.active?.state,
        scriptURL: registration.active?.scriptURL,
      });
      
      // Send a message to the service worker to test communication
      registration.active.postMessage({
        type: 'TEST_PUSH',
        data: {
          title: 'Test Message',
          body: 'This is a test message from the debugger'
        }
      });
      
      toast.success('Test message sent to service worker');
    } catch (error) {
      toast.error('Service worker test failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    setLoading(true);
    try {
      console.log('[PushDebugger] Starting push notification test...');
      
      const requestBody = {
        title: 'Test Notification',
        body: 'Push notifications are working! 🎉',
        type: 'test',
      };
      
      console.log('[PushDebugger] Request body:', requestBody);
      
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[PushDebugger] Response status:', response.status);
      console.log('[PushDebugger] Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PushDebugger] Error response:', errorText);
        toast.error(`Server error: ${response.status} ${errorText}`);
        return;
      }

      const result = await response.json();
      console.log('[PushDebugger] Response body:', result);
      
      if (result.success) {
        toast.success(`Test sent to ${result.sentTo} subscribers`);
      } else {
        toast.error(result.error || 'Failed to send test');
      }
    } catch (error) {
      console.error('[PushDebugger] Request failed:', error);
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
        <StatusItem 
          label="Logged In" 
          status={isAuthenticated ? `Yes (${user?.role ?? 'authenticated'})` : 'No - Login Required'}
          good={isAuthenticated}
        />
        
        {/* Mobile-specific indicators */}
        {mobileInfo.isMobile && (
          <>
            <StatusItem 
              label="Device Type" 
              status="Mobile"
              good={true}
            />
            <StatusItem 
              label="PWA Installed" 
              status={mobileInfo.isPWAInstalled ? 'Yes' : 'No'}
              good={mobileInfo.isPWAInstalled}
            />
          </>
        )}
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
            disabled={loading || !isAuthenticated}
            className="w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            {isAuthenticated ? 'Subscribe to Notifications' : 'Login Required to Subscribe'}
          </Button>
        )}

        <Button
          onClick={testServiceWorker} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Test Service Worker
        </Button>

        <Button 
          onClick={testNotification} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Send Push Notification
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

      {mobileInfo.isMobile && !mobileInfo.isPWAInstalled && (
        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>Mobile Browser Detected!</strong> For reliable push notifications on mobile:
          </p>
          <ul className="mt-2 text-xs text-blue-300 list-disc list-inside">
            <li>Install the app as a PWA (Add to Home Screen)</li>
            <li>Keep the app open in the background</li>
            <li>Ensure battery optimization is disabled</li>
            <li>Check system notification settings</li>
          </ul>
        </div>
      )}

      {mobileInfo.isMobile && mobileInfo.isPWAInstalled && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg">
          <p className="text-sm text-green-200">
            <strong>PWA Installed!</strong> Push notifications should work reliably.
          </p>
        </div>
      )}
    </div>
  );
}
