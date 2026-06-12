import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { updateSettings } from './firebaseService';

export const initPushNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Push notifications are not supported on web natively. Use FCM web if needed.');
    return;
  }

  try {
    // Request permission to use push notifications
    // iOS will prompt user and return if they granted permission or not
    // Android will just grant without prompting
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Salvar token globalmente (para o admin)
      await updateSettings({ fcmToken: token.value });
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
    });

    // Create custom channel for Android with the kaching sound
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'rifas_vendas',
        name: 'Vendas e Reservas',
        description: 'Notificações de novas vendas e pix gerados',
        importance: 5,
        visibility: 1,
        sound: 'kaching', // name of the mp3 file in res/raw without extension
        vibration: true
      });
    }

  } catch (e) {
    console.error('Failed to init push notifications', e);
  }
};
