import { registerPlugin } from '@capacitor/core';

export interface YuiNativePluginInterface {
  openApp(options: { appName: string; packageName?: string }): Promise<{ success: boolean; message: string }>;
  sendWhatsAppMessage(options: { phoneNumber: string; message: string }): Promise<{ success: boolean; message: string }>;
  startForegroundService(): Promise<{ success: boolean; message: string }>;
  stopForegroundService(): Promise<{ success: boolean; message: string }>;
  getRecentNotifications(): Promise<{ notifications: Array<{ packageName: string; sender: string; text: string; timestamp: number }> }>;
  makePhoneCall(options: { phoneNumber: string }): Promise<{ success: boolean }>;
  toggleFlashlight(options: { enable: boolean }): Promise<{ success: boolean; enabled: boolean }>;
}

// Register Native Plugin Bridge
const NativeYui = registerPlugin<YuiNativePluginInterface>('YuiNative');

/**
 * Universal Native Utility Wrapper
 * Uses Capacitor Native Plugin when running on Android/iOS app, with automatic Web Fallbacks when running in Browser.
 */
export const YuiNative = {
  async openApp(appName: string, packageName?: string) {
    try {
      return await NativeYui.openApp({ appName, packageName });
    } catch (_) {
      // Browser Fallback
      if (appName.toLowerCase().includes('whatsapp')) {
        window.open('https://web.whatsapp.com', '_blank');
      } else if (appName.toLowerCase().includes('youtube')) {
        window.open('https://www.youtube.com', '_blank');
      } else if (appName.toLowerCase().includes('instagram')) {
        window.open('https://instagram.com', '_blank');
      } else {
        window.open('https://www.google.com', '_blank');
      }
      return { success: true, message: `Opened ${appName} in web browser` };
    }
  },

  async sendWhatsAppMessage(phoneNumber: string, message: string) {
    try {
      return await NativeYui.sendWhatsAppMessage({ phoneNumber, message });
    } catch (_) {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
      return { success: true, message: 'Opened WhatsApp Web' };
    }
  },

  async startForegroundService() {
    try {
      return await NativeYui.startForegroundService();
    } catch (_) {
      return { success: false, message: 'Foreground service only supported on Android app' };
    }
  },

  async stopForegroundService() {
    try {
      return await NativeYui.stopForegroundService();
    } catch (_) {
      return { success: false, message: 'Foreground service only supported on Android app' };
    }
  },

  async getRecentNotifications() {
    try {
      return await NativeYui.getRecentNotifications();
    } catch (_) {
      return { notifications: [] };
    }
  },

  async makePhoneCall(phoneNumber: string) {
    try {
      return await NativeYui.makePhoneCall({ phoneNumber });
    } catch (_) {
      window.location.href = `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`;
      return { success: true };
    }
  },

  async toggleFlashlight(enable: boolean) {
    try {
      return await NativeYui.toggleFlashlight({ enable });
    } catch (_) {
      return { success: false, enabled: false };
    }
  },
};
