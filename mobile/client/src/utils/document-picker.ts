/**
 * Shared Document & Image Picker Helper.
 * Supports Camera, Photo Gallery, and File System (PDF or Image up to 5MB).
 */

import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PickedDocument {
  uri: string;
  name: string;
  type: string;
  isPdf: boolean;
}

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function isPdfAsset(
  file?: { uri?: string | null; name?: string | null; type?: string | null } | null
): boolean {
  if (!file) return false;
  if (file.type?.toLowerCase().includes('pdf')) return true;
  if (file.name?.toLowerCase().endsWith('.pdf')) return true;
  if (file.uri?.toLowerCase().split('?')[0].endsWith('.pdf')) return true;
  return false;
}

export function normalizePickedAsset(
  uri: string,
  rawName?: string | null,
  rawMime?: string | null,
  fallbackPrefix = 'document'
): PickedDocument {
  const mimeLower = (rawMime ?? '').toLowerCase();
  const uriBase = uri.split('?')[0];
  const rawNameClean = rawName || uriBase.split('/').pop() || '';
  const nameLower = rawNameClean.toLowerCase();

  let type = 'image/jpeg';
  let ext = 'jpg';
  let isPdf = false;

  if (mimeLower === 'application/pdf' || nameLower.endsWith('.pdf') || uriBase.toLowerCase().endsWith('.pdf')) {
    type = 'application/pdf';
    ext = 'pdf';
    isPdf = true;
  } else if (mimeLower === 'image/png' || nameLower.endsWith('.png')) {
    type = 'image/png';
    ext = 'png';
  } else if (mimeLower === 'image/webp' || nameLower.endsWith('.webp')) {
    type = 'image/webp';
    ext = 'webp';
  } else if (mimeLower === 'image/jpeg' || mimeLower === 'image/jpg' || nameLower.endsWith('.jpeg') || nameLower.endsWith('.jpg')) {
    type = 'image/jpeg';
    ext = 'jpg';
  }

  let name = rawNameClean.trim() || `${fallbackPrefix}_${Date.now()}.${ext}`;
  if (!/\.\w+$/.test(name)) {
    name = `${name}.${ext}`;
  }

  return { uri, name, type, isPdf };
}

export async function pickFromCamera(
  options: { allowsEditing?: boolean; aspect?: [number, number]; fallbackPrefix?: string } = {}
): Promise<PickedDocument | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
    return null;
  }

  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: 0.8,
  });

  if (res.canceled || !res.assets[0]) return null;

  const asset = res.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
    Alert.alert('File Too Large', 'Captured photo exceeds the 5MB size limit.');
    return null;
  }

  return normalizePickedAsset(asset.uri, asset.fileName, asset.mimeType, options.fallbackPrefix);
}

export async function pickFromGallery(
  options: { allowsEditing?: boolean; aspect?: [number, number]; fallbackPrefix?: string } = {}
): Promise<PickedDocument | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission Required', 'Please allow photo library access to upload images.');
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: 0.8,
  });

  if (res.canceled || !res.assets[0]) return null;

  const asset = res.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
    Alert.alert('File Too Large', 'Selected image exceeds the 5MB size limit.');
    return null;
  }

  return normalizePickedAsset(asset.uri, asset.fileName, asset.mimeType, options.fallbackPrefix);
}

export async function pickPdfOrImageDocument(fallbackPrefix = 'document'): Promise<PickedDocument | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (res.canceled || !res.assets[0]) return null;

  const asset = res.assets[0];
  if (asset.size && asset.size > MAX_DOCUMENT_SIZE_BYTES) {
    Alert.alert('File Too Large', 'Maximum allowed file size is 5MB.');
    return null;
  }

  const normalized = normalizePickedAsset(asset.uri, asset.name, asset.mimeType, fallbackPrefix);
  const rawMime = (asset.mimeType ?? '').toLowerCase();
  const extAllowed = /\.(pdf|jpe?g|png|webp)$/i.test(normalized.name);

  if (rawMime && !SUPPORTED_MIME_TYPES.has(rawMime) && !extAllowed) {
    Alert.alert('Unsupported File', 'Please upload a valid JPG, PNG, WEBP, or PDF file.');
    return null;
  }

  return normalized;
}

export interface DocumentPickerPromptOptions {
  title?: string;
  fallbackPrefix?: string;
  allowsEditing?: boolean;
  aspect?: [number, number];
}

export function showDocumentSourcePicker(
  onPicked: (doc: PickedDocument) => void,
  options: DocumentPickerPromptOptions = {}
): void {
  const {
    title = 'Upload Document (Image or PDF)',
    fallbackPrefix = 'document',
    allowsEditing = false,
    aspect,
  } = options;

  const handleResult = (doc: PickedDocument | null) => {
    if (doc) onPicked(doc);
  };

  if (Platform.OS === 'web') {
    pickPdfOrImageDocument(fallbackPrefix).then(handleResult);
    return;
  }

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message: 'Accepted formats: JPG, PNG, WEBP, or PDF (max 5MB)',
        options: ['Cancel', 'Take Photo (Camera)', 'Photo Gallery (Image)', 'Choose File (PDF / Image)'],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx === 1) pickFromCamera({ allowsEditing, aspect, fallbackPrefix }).then(handleResult);
        if (idx === 2) pickFromGallery({ allowsEditing, aspect, fallbackPrefix }).then(handleResult);
        if (idx === 3) pickPdfOrImageDocument(fallbackPrefix).then(handleResult);
      }
    );
    return;
  }

  // Android Alert renders up to 3 action buttons reliably; tap outside dismisses.
  Alert.alert(
    title,
    'Choose how to upload (JPG, PNG, WEBP, or PDF · max 5MB)',
    [
      {
        text: 'Take Photo',
        onPress: () => pickFromCamera({ allowsEditing, aspect, fallbackPrefix }).then(handleResult),
      },
      {
        text: 'Gallery',
        onPress: () => pickFromGallery({ allowsEditing, aspect, fallbackPrefix }).then(handleResult),
      },
      {
        text: 'PDF / File',
        onPress: () => pickPdfOrImageDocument(fallbackPrefix).then(handleResult),
      },
    ],
    { cancelable: true }
  );
}
