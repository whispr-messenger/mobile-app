import React, { useState } from "react";
import { ScrollView, Text, Button, View, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { tfliteService } from "@/services/moderation/tflite.service";

export default function TfliteTestScreen() {
    const [uri, setUri] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const push = (s: any) => setLog((x) => [...x, String(s)]);
    const clear = () => setLog([]);

    const pickAndTest = async () => {
        clear();
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                push("Permission denied ❌");
                return;
            }

            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images, // 兼容你当前版本
                quality: 1,
            });

            if (picked.canceled) {
                push("Canceled.");
                return;
            }

            const u = picked.assets[0].uri;
            setUri(u);
            push("Image selected ✅");
            push(u);

            push("Running gate...");

            const threshold = 0.8; // ✅ 推荐默认
            const r = await tfliteService.gate({ uri: u, threshold });

            push(`threshold: ${threshold}`);
            push(`best_class: ${r.bestClass}`);
            push(`best_prob: ${(r.bestProb * 100).toFixed(2)}%`);
            push(`reason: ${r.reason}`);
            push(`allowed (true=放行, false=拦截): ${r.allowed}`);

            push("---- probs ----");
            Object.entries(r.probs).forEach(([name, p]) => {
                push(`${name}: ${(p * 100).toFixed(2)}%`);
            });
        } catch (e: any) {
            push("ERROR:");
            push(e?.stack || e?.message || String(e));
        }
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>TFLite Gate Test</Text>
            <Button title="Pick Image from Gallery + Test" onPress={pickAndTest} />

            {uri && (
                <Image
                    source={{ uri }}
                    style={{ width: "100%", height: 240, borderRadius: 12 }}
                    resizeMode="cover"
                />
            )}

            <View style={{ padding: 12, borderWidth: 1, borderRadius: 10 }}>
                {log.map((l, i) => (
                    <Text key={i} selectable style={{ marginBottom: 6 }}>
                        {l}
                    </Text>
                ))}
            </View>
        </ScrollView>
    );
}
