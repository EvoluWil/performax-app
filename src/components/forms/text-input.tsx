import {
  StyleProp,
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { FieldPath, FieldValues, UseControllerProps } from 'react-hook-form';

import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';

import { useField } from './use-field';

export type TextInputProps<T extends FieldValues, TName extends FieldPath<T>> = UseControllerProps<T, TName> &
  Omit<RNTextInputProps, 'value' | 'onChangeText' | 'defaultValue' | 'editable' | 'style'> & {
    label?: string;
    format?: (value: string) => string;
    blockStyle?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    style?: RNTextInputProps['style'];
  };

export function TextInput<T extends FieldValues, TName extends FieldPath<T>>({
  name,
  control,
  defaultValue,
  rules,
  shouldUnregister,
  disabled,
  label,
  format,
  blockStyle,
  containerStyle,
  style,
  multiline,
  placeholderTextColor,
  onBlur,
  ...props
}: TextInputProps<T, TName>) {
  const { field, message, locked } = useField({ name, control, defaultValue, rules, shouldUnregister, disabled });

  return (
    <View style={[styles.block, blockStyle]}>
      {label ? <AppText weight="semibold">{label}</AppText> : null}
      <View style={[styles.frame, multiline ? styles.frameMulti : null, containerStyle]} collapsable={false}>
        <RNTextInput
          {...props}
          multiline={multiline}
          editable={!locked}
          placeholderTextColor={placeholderTextColor ?? theme.color.muted}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={(text) => field.onChange(format ? format(text) : text)}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
          style={[styles.input, multiline ? styles.multiline : null, style]}
        />
      </View>
      {message ? (
        <AppText color={theme.color.error} accessibilityRole="alert">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  frame: {
    minHeight: 56,
    justifyContent: 'center',
  },
  frameMulti: {
    minHeight: 120,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: theme.color.text,
    fontFamily: theme.font.regular,
    fontSize: 16,
    height: 56,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  multiline: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
});
