import { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";

export interface Feature {
  text: string;
  locked?: boolean;
}

interface PlanCompareCardProps {
  title: string;
  features: Feature[];
  isPremium?: boolean;
  button?: ReactNode;
}

export default function PlanCompareCard({
  title,
  features,
  isPremium,
  button,
}: PlanCompareCardProps) {
  return (
    <View style={[s.planCompareCard, isPremium && s.planCompareCardPremium]}>
      <View style={s.planCompareTitleRow}>
        <Text style={[s.planCompareTitle, isPremium && { color: "#fc6c14" }]}>{title}</Text>
        {isPremium && (
          <View style={s.planCompareBadge}>
            <Text style={s.planCompareBadgeText}>★ PREMIUM</Text>
          </View>
        )}
      </View>
      {features.map((f, i) => (
        <View key={f.text + i} style={s.planCompareRow}>
          <Text
            style={[
              f.locked ? s.planCompareLock : s.planCompareCheck,
              isPremium && !f.locked && { color: "#fc6c14" },
            ]}
          >
            {f.locked ? "○" : "✓"}
          </Text>
          <Text style={f.locked ? s.planCompareTextLocked : s.planCompareText}>{f.text}</Text>
        </View>
      ))}
      {button}
    </View>
  );
}

const s = StyleSheet.create({
  planCompareCard: {
    borderWidth: 1.5,
    borderColor: "#e8e0d8",
    borderRadius: 16,
    padding: 20,
    gap: 10,
    backgroundColor: "#fafaf9",
  },
  planCompareCardPremium: {
    borderColor: "#fc6c14",
    backgroundColor: "#fff9f5",
  },
  planCompareTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  planCompareTitle: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
  },
  planCompareBadge: {
    backgroundColor: "#fc6c14",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planCompareBadgeText: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  planCompareRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  planCompareCheck: {
    fontSize: 15,
    color: "#2D6A4F",
    fontFamily: "FiraSansCondensed_700Bold",
    lineHeight: 22,
    width: 18,
  },
  planCompareLock: {
    fontSize: 15,
    color: "#ccc",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 22,
    width: 18,
  },
  planCompareText: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#333",
    flex: 1,
    lineHeight: 22,
  },
  planCompareTextLocked: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#bbb",
    flex: 1,
    lineHeight: 22,
  },
});
