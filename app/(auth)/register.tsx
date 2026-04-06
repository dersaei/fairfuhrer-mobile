import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!email || !username || !password || !confirmPassword) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (username.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'consumer',
          username,
        },
        emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL,
      },
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Diese E-Mail-Adresse ist bereits registriert.');
      } else {
        setError('Registrierung fehlgeschlagen. Bitte erneut versuchen.');
      }
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>FAIRFÜHRER</Text>
          <Text style={styles.title}>Fast fertig!</Text>
          <Text style={styles.successText}>
            Bitte prüfe deine E-Mails und bestätige deine Registrierung.
          </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Zurück zum Login
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>FAIRFÜHRER</Text>
          <Text style={styles.title}>Registrieren</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TextInput
            style={styles.input}
            placeholder="E-Mail"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Benutzername (min. 3 Zeichen)"
            placeholderTextColor="#aaa"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username-new"
          />

          <TextInput
            style={styles.input}
            placeholder="Passwort (min. 8 Zeichen)"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <TextInput
            style={styles.input}
            placeholder="Passwort wiederholen"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Konto erstellen</Text>
            }
          </TouchableOpacity>

          <Link href="/(auth)/login" style={styles.link}>
            Bereits registriert? Anmelden
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 32,
  },
  logo: {
    fontFamily: 'Anton_400Regular',
    fontSize: 32,
    color: '#fc6c14',
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  error: {
    color: '#c0392b',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#fdecea',
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#2D6A4F',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    textAlign: 'center',
    color: '#2D6A4F',
    fontSize: 14,
    marginTop: 4,
  },
});
