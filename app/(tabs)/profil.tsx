import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function ProfilScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profil</Text>

        {user ? (
          <>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Free</Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={signOut}>
              <Text style={styles.buttonText}>Abmelden</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.subtitle}>Nicht eingeloggt</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  email: {
    fontSize: 16,
    color: '#333',
  },
  badge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#2D6A4F',
    fontWeight: '600',
    fontSize: 13,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
