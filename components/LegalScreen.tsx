import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { directus } from '@/lib/directus';
import { readSingleton, readItems } from '@directus/sdk';
import SimpleMarkdown from '@/components/SimpleMarkdown';

const FF_ORANGE = '#fc6c14';
const FF_BLACK = '#181716';

interface Props {
  title: string;
  collection: string;
  // 'singleton' = single item with `content` field
  // 'list' = multiple items with `frage` + `antworte` fields
  mode?: 'singleton' | 'list';
}

interface FaqItem {
  id: string;
  sort: number;
  frage: string;
  antworte: string;
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12l7 7M5 12l7-7" stroke={FF_BLACK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
      <Path d="M6 9l6 6 6-6" stroke="#666" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function LegalScreen({ title, collection, mode = 'singleton' }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (mode === 'singleton') {
          const data = await directus.request(readSingleton(collection as any, { fields: ['content'] }));
          setContent((data as any).content ?? '');
        } else {
          const data = await directus.request(readItems(collection as any, { fields: ['id', 'sort', 'frage', 'antworte'], sort: ['sort'] }));
          setFaqItems(data as FaqItem[]);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [collection, mode]);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{title}</Text>
        <View style={s.backBtn} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={FF_ORANGE} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>Inhalt konnte nicht geladen werden.</Text>
        </View>
      ) : mode === 'singleton' ? (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <SimpleMarkdown content={content ?? ''} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {faqItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={s.faqItem}
              onPress={() => setOpenFaq(openFaq === item.id ? null : item.id)}
              activeOpacity={0.7}
            >
              <View style={s.faqQuestion}>
                <Text style={s.faqQuestionText}>{item.frage}</Text>
                <ChevronIcon open={openFaq === item.id} />
              </View>
              {openFaq === item.id && (
                <View style={s.faqAnswer}>
                  <SimpleMarkdown content={item.antworte} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Anton_400Regular',
    fontSize: 18,
    color: FF_BLACK,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'FiraSansCondensed_400Regular',
    fontSize: 15,
    color: '#999',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 4,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  faqQuestionText: {
    fontFamily: 'FiraSansCondensed_600SemiBold',
    fontSize: 15,
    color: FF_BLACK,
    flex: 1,
    lineHeight: 20,
  },
  faqAnswer: {
    paddingBottom: 16,
    paddingRight: 8,
  },
});
