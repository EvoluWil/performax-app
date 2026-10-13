import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TextInput } from '@/components/forms/text-input';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';
import { signInSchema, SignInValues } from '@/features/auth/sign-in.schema';
import { useBrand } from '@/providers/brand-provider';
import { useSession } from '@/providers/session-provider';

export function LoginScreen() {
  const { signIn } = useSession();
  const brand = useBrand();
  const router = useRouter();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState } = useForm<SignInValues>({
    resolver: yupResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.brand, { backgroundColor: brand.primary }]}>
        <AppText variant="title" color={theme.color.white}>
          {brand.name}
        </AppText>
        <AppText color={theme.color.white}>Entrar para executar ordens de serviço.</AppText>
      </View>

      <View style={styles.form}>
        <TextInput
          control={control}
          name="email"
          label="E-mail"
          accessibilityLabel="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="seu.email@empresa.com"
          containerStyle={styles.input}
        />

        <TextInput
          control={control}
          name="password"
          label="Senha"
          accessibilityLabel="Senha"
          secureTextEntry
          onSubmitEditing={() => void submit()}
          placeholder="Senha"
          containerStyle={styles.input}
        />

        {error ? (
          <AppText color={theme.color.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}

        <AppButton label="Entrar" onPress={() => void submit()} loading={formState.isSubmitting} color={brand.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.background,
    gap: 28,
  },
  brand: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 28,
    gap: 8,
  },
  form: {
    gap: 12,
    paddingHorizontal: theme.space,
    paddingBottom: 24,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    backgroundColor: theme.color.white,
  },
});
