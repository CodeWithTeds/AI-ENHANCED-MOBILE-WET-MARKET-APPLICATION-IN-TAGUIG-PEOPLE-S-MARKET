/**
 * DocumentUploader — file picker component for document uploads.
 * Uses expo-image-picker for picking images/documents.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import type { DocumentUpload } from '@/types/vendor';

interface DocumentUploaderProps {
  label: string;
  description: string;
  document: DocumentUpload | null;
  onPick: () => void;
  onRemove: () => void;
  error?: string;
}

export function DocumentUploader({
  label,
  description,
  document,
  onPick,
  onRemove,
  error,
}: DocumentUploaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>
      <Text style={styles.description}>{description}</Text>

      {document ? (
        <View style={styles.fileCard}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileIcon}>📄</Text>
            <Text style={styles.fileName} numberOfLines={1}>
              {document.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRemove}
            style={styles.removeButton}
            accessibilityLabel={`Remove ${label}`}
            accessibilityRole="button"
          >
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, error ? styles.uploadError : null]}
          onPress={onPick}
          accessibilityLabel={`Upload ${label}`}
          accessibilityRole="button"
        >
          <Text style={styles.uploadIcon}>📁</Text>
          <Text style={styles.uploadText}>Tap to upload</Text>
          <Text style={styles.uploadHint}>JPG, PNG, or PDF (max 5MB)</Text>
        </TouchableOpacity>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  required: {
    color: Colors.destructive,
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  uploadButton: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
  },
  uploadError: {
    borderColor: Colors.destructive,
  },
  uploadIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  uploadHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    padding: 12,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.destructive + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeText: {
    fontSize: 14,
    color: Colors.destructive,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: Colors.destructive,
    marginTop: 6,
  },
});
