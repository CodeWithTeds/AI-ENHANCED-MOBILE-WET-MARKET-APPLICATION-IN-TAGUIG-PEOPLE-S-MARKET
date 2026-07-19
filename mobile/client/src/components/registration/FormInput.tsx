/**
 * FormInput — reusable styled text input for registration forms.
 */

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
  required?: boolean;
}

export function FormInput({
  label,
  error,
  isPassword = false,
  required = false,
  ...props
}: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  required: {
    color: Colors.destructive,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.destructive,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.text,
  },
  eyeButton: {
    padding: 8,
  },
  eyeText: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 12,
    color: Colors.destructive,
    marginTop: 4,
    marginLeft: 4,
  },
});
