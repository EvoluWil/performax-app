import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getApps, initializeApp } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

import { TaskFile } from '@/features/task/types';

const MAX_BYTES = 8 * 1024 * 1024;

function firebaseApp() {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error('O envio de arquivos não está configurado.');
  }

  const existing = getApps()[0];
  if (existing) return existing;

  return initializeApp({
    apiKey,
    projectId,
    authDomain: `${projectId}.firebaseapp.com`,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
}

async function compress(uri: string) {
  const first = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  if (new File(first.uri).size <= MAX_BYTES) return first.uri;

  const second = await manipulateAsync(first.uri, [{ resize: { width: 1280 } }], {
    compress: 0.45,
    format: SaveFormat.JPEG,
  });
  if (new File(second.uri).size > MAX_BYTES) {
    throw new Error('A foto ficou grande demais. Tente outra imagem.');
  }
  return second.uri;
}

export async function pickTaskPhoto(source: 'camera' | 'library') {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permita o uso da câmera para anexar a foto.');
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permita o acesso às fotos para anexar a evidência.');
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return compress(result.assets[0].uri);
}

export async function uploadTaskPhoto(taskId: string, uri: string, folder: 'evidence' | 'conclusion') {
  const app = firebaseApp();
  const storage = getStorage(app);
  const path = `tasks/${taskId}/${folder}/${Date.now()}.jpg`;
  const storageRef = ref(storage, path);
  const bytes = await new File(uri).bytes();
  await uploadBytes(storageRef, bytes, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);
  const file: TaskFile = { url, type: 'jpg' };
  return file;
}

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp']);

export function isImageFile(file: TaskFile) {
  return IMAGE_TYPES.has(file.type.toLowerCase());
}

export async function pickTaskFile() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const size = asset.size ?? new File(asset.uri).size;
  if (size > MAX_BYTES) {
    throw new Error('O arquivo ficou grande demais. O limite é 8 MB.');
  }
  return asset;
}

export async function uploadTaskAttachment(
  taskId: string,
  asset: { uri: string; name: string; mimeType?: string | null },
  folder: 'evidence' | 'conclusion',
) {
  if (asset.mimeType?.startsWith('image/')) {
    const uri = await compress(asset.uri);
    return uploadTaskPhoto(taskId, uri, folder);
  }

  const app = firebaseApp();
  const storage = getStorage(app);
  const type = fileExtension(asset.name, asset.mimeType);
  const path = `tasks/${taskId}/${folder}/${Date.now()}.${type}`;
  const storageRef = ref(storage, path);
  const bytes = await new File(asset.uri).bytes();
  await uploadBytes(storageRef, bytes, {
    contentType: asset.mimeType || 'application/octet-stream',
  });
  const url = await getDownloadURL(storageRef);
  const file: TaskFile = { url, type };
  return file;
}

function fileExtension(name: string, mimeType?: string | null) {
  const fromName = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length > 0 && fromName.length <= 5 && fromName !== name.toLowerCase()) return fromName;
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('jpeg')) return 'jpg';
  return 'file';
}
