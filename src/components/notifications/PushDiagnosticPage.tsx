'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPushService } from '@/lib/notifications/push-service';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PushDiagnosticPage() {
  const { user, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverDiagnosis, setServerDiagnosis] = useState<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Run client-side diagnostics
  const runClientDiagnostics = async () => {
    setLogs([]);
    addLog('=== CLIENT-SIDE DIAGNOSTICS ===');

    // Check 1: Browser support
    addLog('1. Checking browser support...');
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    addLog(`   Service Worker: ${hasServiceWorker ? 'YES' : 'NO'}`);
    addLog(`   Push Manager: ${hasPushManager ? 'YES' : 'NO'}`);
    addLog(`   Notification: ${hasNotification ? 'YES' : 'NO'}`);

    if (!hasServiceWorker || !hasPushManager) {
      addLog('   ❌ Browser does not support push notifications');
      return;
    }

    // Check 2: Notification permission
    addLog('2. Checking notification permission...');
    const permission = Notification.permission;
    addLog(`   Permission: ${permission}`);
    if (permission !== 'granted') {
      addLog('   ❌ Notification permission not granted');
      return;
    }

    // Check 3: Service Worker registration
    addLog('3. Checking service worker...');
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      addLog('   ❌ No service worker registration found');
      return;
    }
    addLog(`   Registration scope: ${registration.scope}`);
    addLog(`   SW active: ${registration.active ? 'YES' : 'NO'}`);

    // Check 4: Push subscription
    addLog('4. Checking push subscription...');
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      addLog('   ❌ No push subscription found');
      addLog('   You need to click "Subscribe" first');
      return;
    }
    addLog('   ✅ Push subscription exists');
    
    const subJson = subscription.toJSON();
    addLog(`   Endpoint: ${subJson.endpoint?.substring(0, 80)}...`);
    addLog(`   Has p256dh: ${!!subJson.keys?.p256dh}`);
    addLog(`   Has auth: ${!!subJson.keys?.auth}`);

    // Check 5: VAPID key on client
    addLog('5. Checking VAPID public key...');
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    addLog(`   VAPID key exists: ${!!vapidKey}`);
    addLog(`   VAPID key length: ${vapidKey?.length || 0}`);

    addLog('✅ Client-side checks complete');
  };

  // Subscribe
  const subscribe = async () => {
    setLoading(true);
    addLog('Attempting to subscribe...');
    
    if (!isAuthenticated || !user?.id) {
      addLog('❌ Not logged in!');
      toast.error('Please log in first');
      setLoading(false);
      return;
    }

    try {
      const pushService = getPushService();
      const result = await pushService.subscribe(user.id);
      
      if (result) {
        addLog('✅ Subscription successful');
        addLog(`   Endpoint: ${result.endpoint.substring(0, 80)}...`);
        toast.success('Subscribed!');
      } else {
        addLog('❌ Subscription returned null');
        toast.error('Subscription failed');
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      console.error(error);
    }
    setLoading(false);
  };

  // Run server diagnostics
  const runServerDiagnostics = async () => {
    setLoading(true);
    addLog('Fetching server diagnostics...');
    
    try {
      const res = await fetch('/api/notifications/diagnose');
      const data = await res.json();
      setServerDiagnosis(data);
      
      addLog('=== SERVER DIAGNOSTICS ===');
      data.steps?.forEach((step: any) => {
        addLog(`${step.step}. ${step.name}: ${step.success !== false ? '✅' : '❌'}`);
        if (step.error) addLog(`   Error: ${step.error}`);
        if (step.warning) addLog(`   Warning: ${step.message}`);
        if (step.totalSubscriptions !== undefined) addLog(`   Total: ${step.totalSubscriptions}`);
        if (step.issues?.length > 0) {
          step.issues.forEach((issue: string) => addLog(`   ⚠️ ${issue}`));
        }
      });
    } catch (error: any) {
      addLog(`❌ Failed to get diagnostics: ${error.message}`);
    }
    setLoading(false);
  };

  // Test send
  const testSend = async () => {
    setLoading(true);
    addLog('Testing direct send...');
    
    try {
      const res = await fetch('/api/notifications/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      
      if (data.success) {
        addLog('✅ Notification sent successfully!');
        addLog(`   Subscription: ${data.subscriptionId}`);
        toast.success('Notification sent - check your device!');
      } else {
        addLog(`❌ Send failed: ${data.error}`);
        addLog(`   Status code: ${data.statusCode}`);
        addLog(`   Body: ${data.body}`);
        toast.error('Send failed - check logs');
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Test via normal API
  const testViaNormalAPI = async () => {
    setLoading(true);
    addLog('Testing via /api/notifications/send...');
    
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test',
          title: 'Normal API Test',
          body: 'Testing via normal send API',
        }),
      });
      const data = await res.json();
      
      addLog(`Response status: ${res.status}`);
      addLog(`Response: ${JSON.stringify(data, null, 2)}`);
      
      if (data.success) {
        toast.success(`Sent to ${data.sentTo} subscribers`);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    runClientDiagnostics();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-slate-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">🔍 Push Notification Deep Diagnostics</h1>
      
      <div className="mb-6 space-y-2">
        <div className="flex gap-2">
          <Button onClick={runClientDiagnostics} disabled={loading}>
            Run Client Diagnostics
          </Button>
          <Button onClick={subscribe} disabled={loading || !isAuthenticated}>
            Subscribe
          </Button>
          <Button onClick={runServerDiagnostics} disabled={loading} variant="outline">
            Server Diagnostics
          </Button>
        </div>
        <div className="flex gap-2">
          <Button onClick={testSend} disabled={loading} variant="secondary">
            Test Direct Send
          </Button>
          <Button onClick={testViaNormalAPI} disabled={loading} variant="secondary">
            Test Normal API Send
          </Button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm overflow-auto max-h-[500px]">
        {logs.length === 0 ? (
          <p className="text-slate-400">Click a button above to run diagnostics...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`mb-1 ${
              log.includes('❌') ? 'text-red-400' : 
              log.includes('✅') ? 'text-green-400' :
              log.includes('⚠️') ? 'text-yellow-400' :
              'text-slate-300'
            }`}>
              {log}
            </div>
          ))
        )}
      </div>

      {serverDiagnosis && (
        <div className="mt-6 bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold mb-2">Raw Server Response:</h3>
          <pre className="text-xs overflow-auto max-h-[300px] text-slate-300">
            {JSON.stringify(serverDiagnosis, null, 2)}
          </pre>
        </div>
      )}

      {!isAuthenticated && (
        <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-200 font-bold">⚠️ You are not logged in!</p>
          <p className="text-red-300 text-sm mt-1">
            Push notifications require a valid user account. Please log in first.
          </p>
        </div>
      )}
    </div>
  );
}
