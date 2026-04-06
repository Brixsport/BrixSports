import PushNotificationDebugger from '@/components/notifications/PushNotificationDebugger';

export default function NotificationsAdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Push Notification Diagnostics</h1>
      <PushNotificationDebugger />
    </div>
  );
}
