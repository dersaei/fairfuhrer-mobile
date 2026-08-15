import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { openExternalUrl } from "@/lib/openExternalUrl";

const FF_ORANGE = "#fc6c14";
const FF_BLACK = "#181716";

interface Props {
  content: string;
}

export default function SimpleMarkdown({ content }: Props) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={key++} style={s.h2}>
          {line.slice(3)}
        </Text>,
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={key++} style={s.h3}>
          {line.slice(4)}
        </Text>,
      );
      i++;
      continue;
    }

    // HR
    if (line.trim() === "---") {
      elements.push(<View key={key++} style={s.hr} />);
      i++;
      continue;
    }

    // Table (lines starting with |)
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Skip separator row (---|---)
      const rows = tableLines.filter((l) => !l.match(/^\|[-|\s:]+\|$/));
      elements.push(
        <View key={key++} style={s.table}>
          {rows.map((row, ri) => {
            const cells = row
              .split("|")
              .filter((_, ci) => ci > 0 && ci < row.split("|").length - 1);
            return (
              <View key={ri} style={[s.tableRow, ri === 0 && s.tableHeaderRow]}>
                {cells.map((cell, ci) => (
                  <Text key={ci} style={[s.tableCell, ri === 0 && s.tableHeaderCell]}>
                    {cell.trim()}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>,
      );
      continue;
    }

    // Numbered list (1. ...)
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <View key={key++} style={s.list}>
          {items.map((item, idx) => (
            <View key={idx} style={s.listItem}>
              <Text style={s.listNumber}>{idx + 1}.</Text>
              <Text style={s.listText}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Bullet list (- ...)
    if (line.startsWith("- ") || line.startsWith("  - ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("  - "))) {
        items.push(lines[i].replace(/^\s*-\s/, ""));
        i++;
      }
      elements.push(
        <View key={key++} style={s.list}>
          {items.map((item, idx) => (
            <View key={idx} style={s.listItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.listText}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <Text key={key++} style={s.paragraph}>
        {renderInline(line)}
      </Text>,
    );
    i++;
  }

  return <View>{elements}</View>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Handle **bold**, *italic*, [link](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((https?:\/\/[^\)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={k++}>{text.slice(last, match.index)}</Text>);
    }
    if (match[2]) {
      parts.push(
        <Text key={k++} style={s.bold}>
          {match[2]}
        </Text>,
      );
    } else if (match[3]) {
      parts.push(
        <Text key={k++} style={s.italic}>
          {match[3]}
        </Text>,
      );
    } else if (match[4] && match[5]) {
      const url = match[5];
      parts.push(
        <Text
          key={k++}
          style={s.link}
          onPress={() => openExternalUrl(url, "Der Link ist derzeit nicht erreichbar.")}
        >
          {match[4]}
        </Text>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<Text key={k++}>{text.slice(last)}</Text>);
  }
  return parts.length > 0 ? parts : [<Text key={0}>{text}</Text>];
}

const s = StyleSheet.create({
  h2: {
    fontFamily: "Anton_400Regular",
    fontSize: 20,
    color: FF_BLACK,
    marginTop: 24,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  h3: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 16,
    color: FF_BLACK,
    marginTop: 16,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    marginBottom: 6,
  },
  bold: {
    fontFamily: "FiraSansCondensed_700Bold",
    color: FF_BLACK,
  },
  italic: {
    fontStyle: "italic",
  },
  link: {
    color: FF_ORANGE,
    textDecorationLine: "underline",
  },
  hr: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 16,
  },
  list: {
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bullet: {
    fontSize: 15,
    color: FF_ORANGE,
    marginRight: 8,
    lineHeight: 22,
  },
  listNumber: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 15,
    color: FF_ORANGE,
    marginRight: 8,
    lineHeight: 22,
    minWidth: 20,
  },
  listText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    flex: 1,
  },
  table: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableHeaderRow: {
    backgroundColor: "#f5f5f5",
  },
  tableCell: {
    flex: 1,
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#333",
    padding: 8,
  },
  tableHeaderCell: {
    fontFamily: "FiraSansCondensed_700Bold",
    color: FF_BLACK,
  },
});
