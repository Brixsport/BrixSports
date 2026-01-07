'use client';

import { useNotifications, NotificationToast } from './Notifications';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { notifications, removeNotification } = useNotifications();

    return (
        <>
            {children}
            <NotificationToast notifications={notifications} onClose={removeNotification} />
        </>
    );
}
