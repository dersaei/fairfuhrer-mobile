import { useRef, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import { AudioPlayer } from "./AudioPlayer";
import type { DirectusOrte, DirectusKategorie } from "@/types";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const GALLERY_IMAGE_SIZE = Math.floor((SCREEN_WIDTH - 60 - 8) / 2);
const IMAGE_HEIGHT = 280;
const AUDIO_HEIGHT = 130;
const AUDIO_OVERLAP = 52;

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function getImageUrl(place: DirectusOrte): string | null {
  if (place.Titelbild) return `${DIRECTUS_URL}/assets/${place.Titelbild}`;
  if (place.Hauptbild)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/main/${place.Hauptbild}`;
  return null;
}

function getAudioUrl(place: DirectusOrte): string | null {
  if (place.Audio) return `${DIRECTUS_URL}/assets/${place.Audio}`;
  if (place.Audio_Datei)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/audio/${place.Audio_Datei}`;
  return null;
}

function getCategories(place: DirectusOrte): DirectusKategorie[] {
  if (!place.Kategorie) return [];
  return place.Kategorie.map((k) => k.Kategorie_id).filter(
    Boolean,
  ) as DirectusKategorie[];
}

// Zamienia HTML z rich text editora na czysty tekst
function htmlToText(html: string): string {
  return (
    html
      // Zamknięte tagi blokowe → \n
      .replace(/<\/(p|h[1-6]|div|li)[^>]*>/gi, "\n")
      // <br> i <hr> → \n
      .replace(/<(br|hr)[^>]*\/?>/gi, "\n")
      // Otwarte tagi blokowe → usuń (bez \n, żeby nie podwoić)
      .replace(/<(p|h[1-6]|div|li|ul|ol)[^>]*>/gi, "")
      // Pozostałe tagi HTML
      .replace(/<[^>]+>/g, "")
      // Encje HTML — podstawowe
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Encje typograficzne
      .replace(/&rsquo;/g, "\u2019") // '
      .replace(/&lsquo;/g, "\u2018") // '
      .replace(/&rdquo;/g, "\u201D") // "
      .replace(/&ldquo;/g, "\u201C") // "
      .replace(/&bdquo;/g, "\u201E") // „  ← German opening quote
      .replace(/&sbquo;/g, "\u201A") // ‚
      .replace(/&ndash;/g, "\u2013") // –
      .replace(/&mdash;/g, "\u2014") // —
      .replace(/&hellip;/g, "\u2026") // …
      .replace(/&euro;/g, "\u20AC") // €
      .replace(/&times;/g, "\u00D7") // ×
      .replace(/&copy;/g, "\u00A9") // ©
      .replace(/&reg;/g, "\u00AE") // ®
      .replace(/&trade;/g, "\u2122") // ™
      .replace(/&laquo;/g, "\u00AB") // «
      .replace(/&raquo;/g, "\u00BB") // »
      // Niemieckie znaki
      .replace(/&auml;/g, "ä")
      .replace(/&ouml;/g, "ö")
      .replace(/&uuml;/g, "ü")
      .replace(/&Auml;/g, "Ä")
      .replace(/&Ouml;/g, "Ö")
      .replace(/&Uuml;/g, "Ü")
      .replace(/&szlig;/g, "ß")
      // Numeryczne encje &#NNN; i &#xHHH; jako ostatnia szansa
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      )
      // Wiele \n → pojedynczy \n (jeden akapit = jedna linia)
      .replace(/\n+/g, "\n")
      .trim()
  );
}

function CloseIcon({ color = "#fc6c14" }: { color?: string }) {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
      <Line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Fullscreen Gallery Viewer ─────────────────────────────────────────────────

interface GalleryViewerProps {
  images: { key: string; uri: string }[];
  initialIndex: number;
  onClose: () => void;
}

function GalleryViewer({ images, initialIndex, onClose }: GalleryViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const goTo = useCallback(
    (nextIndex: number) => {
      const direction = nextIndex > currentIndex ? -1 : 1;
      Animated.timing(translateX, {
        toValue: direction * SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        translateX.setValue(-direction * SCREEN_WIDTH);
        setCurrentIndex(nextIndex);
        Animated.timing(translateX, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
    },
    [currentIndex, translateX],
  );

  const panRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && currentIndex < images.length - 1)
          goTo(currentIndex + 1);
        else if (g.dx > 50 && currentIndex > 0) goTo(currentIndex - 1);
      },
    }),
  );

  useEffect(() => {
    panRef.current = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && currentIndex < images.length - 1)
          goTo(currentIndex + 1);
        else if (g.dx > 50 && currentIndex > 0) goTo(currentIndex - 1);
      },
    });
  }, [currentIndex, images.length, goTo]);

  return (
    <View style={galleryStyles.overlay}>
      <StatusBar hidden />

      {/* Obraz */}
      <Animated.View
        style={[
          galleryStyles.imageWrapper,
          { transform: [{ translateX }], opacity },
        ]}
        {...panRef.current.panHandlers}
      >
        <Image
          source={{ uri: images[currentIndex].uri }}
          style={galleryStyles.fullImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Zamknij */}
      <TouchableOpacity
        style={[galleryStyles.closeBtn, { top: insets.top + 12 }]}
        onPress={onClose}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <CloseIcon color="#fff" />
      </TouchableOpacity>

      {/* Strzałka lewa */}
      {currentIndex > 0 && (
        <TouchableOpacity
          style={[galleryStyles.arrowBtn, galleryStyles.arrowLeft]}
          onPress={() => goTo(currentIndex - 1)}
          activeOpacity={0.7}
        >
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Line
              x1="15"
              y1="6"
              x2="9"
              y2="12"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Line
              x1="9"
              y1="12"
              x2="15"
              y2="18"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Strzałka prawa */}
      {currentIndex < images.length - 1 && (
        <TouchableOpacity
          style={[galleryStyles.arrowBtn, galleryStyles.arrowRight]}
          onPress={() => goTo(currentIndex + 1)}
          activeOpacity={0.7}
        >
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Line
              x1="9"
              y1="6"
              x2="15"
              y2="12"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Line
              x1="15"
              y1="12"
              x2="9"
              y2="18"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      )}

      {/* Licznik */}
      <View style={[galleryStyles.counter, { bottom: insets.bottom + 20 }]}>
        <Text style={galleryStyles.counterText}>
          {currentIndex + 1} / {images.length}
        </Text>
      </View>
    </View>
  );
}

const galleryStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  arrowBtn: {
    position: "absolute",
    top: "50%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    zIndex: 10,
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  counter: {
    position: "absolute",
    alignSelf: "center",
  },
  counterText: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
  },
});

// ── PlaceInfoPanel ────────────────────────────────────────────────────────────

interface PlaceInfoPanelProps {
  place: DirectusOrte | null;
  visible: boolean;
  onClose: () => void;
}

export function PlaceInfoPanel({
  place,
  visible,
  onClose,
}: PlaceInfoPanelProps) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible && place) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setGalleryIndex(null);
    }
  }, [place?.id, visible]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const imageUrl = place ? getImageUrl(place) : null;
  const audioUrl = place ? getAudioUrl(place) : null;
  const categories = place ? getCategories(place) : [];

  const headerHeight = imageUrl
    ? audioUrl
      ? IMAGE_HEIGHT + AUDIO_OVERLAP
      : IMAGE_HEIGHT
    : audioUrl
      ? AUDIO_HEIGHT
      : 0;

  const directusGallery =
    place?.Galerie?.filter((g) => g?.directus_files_id) ?? [];
  const supabaseGallery = place?.Galerie_Bilder ?? [];
  const galleryImages =
    directusGallery.length > 0
      ? directusGallery.map((g) => ({
          key: g.directus_files_id,
          uri: `${DIRECTUS_URL}/assets/${g.directus_files_id}`,
        }))
      : supabaseGallery.map((f) => ({
          key: f,
          uri: `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/gallery/${f}`,
        }));

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={
        galleryIndex !== null ? () => setGalleryIndex(null) : handleClose
      }
      statusBarTranslucent
    >
      <Animated.View
        style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* ── Stały header: zdjęcie + audio ── */}
        {imageUrl && (
          <View style={styles.imageSection} pointerEvents="box-none">
            <Image
              source={{ uri: imageUrl }}
              style={styles.mainImage}
              resizeMode="cover"
            />
            {audioUrl && (
              <View style={styles.audioOverlay}>
                <AudioPlayer src={audioUrl} />
              </View>
            )}
          </View>
        )}
        {!imageUrl && audioUrl && (
          <View style={styles.audioStandaloneFixed}>
            <AudioPlayer src={audioUrl} />
          </View>
        )}

        {/* ── Przycisk zamknięcia ── */}
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 10 }]}
          onPress={handleClose}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <CloseIcon />
        </TouchableOpacity>

        {/* ── ScrollView ── */}
        <ScrollView
          ref={scrollRef}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
          bounces
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Kategorie */}
            {categories.length > 0 && (
              <View style={styles.categoryBadges}>
                {categories.map((cat) => (
                  <View
                    key={cat.id}
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: cat.Farbe ?? "#999" },
                    ]}
                  >
                    <Text style={styles.categoryBadgeText}>{cat.Name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Nazwa i adres */}
            {place && (
              <View style={styles.placeNameSection}>
                <Text style={styles.placeName}>{place.Name}</Text>
                {place.Adresse ? (
                  <Text style={styles.placeAddress}>{place.Adresse}</Text>
                ) : null}
                {place.Telefon ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${place.Telefon}`)}
                  >
                    <Text style={styles.placePhone}>📞 {place.Telefon}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Opis */}
            {place?.Vollbeschreibung ? (
              <View style={styles.infoSection}>
                <Text style={styles.description}>
                  {htmlToText(place.Vollbeschreibung)}
                </Text>
              </View>
            ) : null}

            {/* Link zewnętrzny */}
            {place?.Link_URL ? (
              <View style={styles.infoSection}>
                <TouchableOpacity
                  style={styles.externalLink}
                  onPress={() =>
                    place.Link_URL && Linking.openURL(place.Link_URL)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.externalLinkText}>
                    {place.Link_Text || "Website besuchen"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Galeria */}
            {galleryImages.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Bildergalerie</Text>
                <View style={styles.gallery}>
                  {galleryImages.map(({ key, uri }, index) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setGalleryIndex(index)}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Zertifizierungen */}
            {place?.Zertifizierungen && place.Zertifizierungen.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>
                  Zertifizierungen & Labels
                </Text>
                <View style={styles.zertGrid}>
                  {place.Zertifizierungen.map((z) => {
                    const item = z.Zertifizierungen_id;
                    if (!item) return null;
                    return (
                      <View key={item.id} style={styles.zertItem}>
                        {item.Image ? (
                          <Image
                            source={{
                              uri: `${DIRECTUS_URL}/assets/${item.Image}`,
                            }}
                            style={styles.zertLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={styles.zertName}>{item.Name}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Przeglądarka galerii (nad panelem, wewnątrz Modala) ── */}
        {galleryIndex !== null && (
          <GalleryViewer
            images={galleryImages}
            initialIndex={galleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fdf6e3",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  imageSection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT,
    zIndex: 1,
  },
  mainImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
  },
  audioOverlay: {
    position: "absolute",
    bottom: -AUDIO_OVERLAP,
    left: "8%",
    right: "8%",
    zIndex: 5,
  },
  audioStandaloneFixed: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 2,
    borderColor: "rgba(252,108,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 20,
  },
  content: {
    backgroundColor: "#fdf6e3",
    minHeight: SCREEN_HEIGHT,
  },
  categoryBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryBadgeText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  placeNameSection: {
    paddingHorizontal: 30,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
  },
  placeName: {
    fontFamily: "Anton_400Regular",
    fontSize: 40,
    color: "#2c3e50",
    textAlign: "center",
  },
  placeAddress: {
    fontFamily: "FiraSansCondensed_500Medium",
    fontSize: 17,
    color: "#2c3e50",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 8,
    paddingHorizontal: 8,
  },
  placePhone: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#28a745",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  infoSection: {
    marginBottom: 32,
    paddingHorizontal: 30,
  },
  description: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 20,
    lineHeight: 26,
    color: "#343a40",
    textAlign: "justify",
  },
  externalLink: {
    backgroundColor: "rgba(252,108,20,1)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "flex-start",
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  externalLinkText: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_500Medium",
    fontSize: 16,
  },
  sectionTitle: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 18,
    color: "#2c3e50",
    marginBottom: 12,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  galleryImage: {
    width: GALLERY_IMAGE_SIZE,
    height: GALLERY_IMAGE_SIZE,
    borderRadius: 12,
  },
  zertGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  zertItem: {
    width: (SCREEN_WIDTH - 48 - 32) / 3,
    alignItems: "center",
    justifyContent: "center",
  },
  zertLogo: {
    width: "100%",
    height: 80,
  },
  zertName: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 12,
    color: "#555",
    textAlign: "center",
  },
});
