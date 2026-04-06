import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function ProfilScreen() {
  const { user, profile, signOut } = useAuth();

  const isPremium = profile?.premium_until
    ? new Date(profile.premium_until) > new Date()
    : false;

  const displayName = profile?.username ?? user?.email ?? '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profil</Text>

        {user ? (
          <>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            {profile?.username && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}

            <Text style={styles.email}>{user.email}</Text>

            <View style={[styles.badge, isPremium && styles.badgePremium]}>
              <Text style={[styles.badgeText, isPremium && styles.badgeTextPremium]}>
                {isPremium ? 'Premium' : 'Free'}
              </Text>
            </View>

            {profile?.role === 'partner' && (
              <View style={styles.badgePartner}>
                <Text style={styles.badgePartnerText}>Partner</Text>
              </View>
            )}

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
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Anton_400Regular',
    color: '#2D6A4F',
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fc6c14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 34,
    color: '#fff',
    fontWeight: '700',
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  email: {
    fontSize: 14,
    color: '#888',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  badge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgePremium: {
    backgroundColor: '#fff8e1',
  },
  badgeText: {
    color: '#2D6A4F',
    fontWeight: '600',
    fontSize: 13,
  },
  badgeTextPremium: {
    color: '#f9a825',
  },
  badgePartner: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgePartnerText: {
    color: '#fc6c14',
    fontWeight: '600',
    fontSize: 13,
  },
  button: {
    marginTop: 16,
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
