/**
 * ScheduleDateTimePicker - Modal for picking a date and time to schedule a message.
 * Custom implementation (no external datetimepicker dependency).
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, withOpacity } from '../../theme/colors';

interface ScheduleDateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

const QUICK_OPTIONS = [
  { label: 'Dans 30 min', minutes: 30 },
  { label: 'Dans 1 heure', minutes: 60 },
  { label: 'Dans 2 heures', minutes: 120 },
  { label: 'Dans 4 heures', minutes: 240 },
  { label: 'Demain 9h', custom: 'tomorrow9' as const },
  { label: 'Demain 14h', custom: 'tomorrow14' as const },
];

function getQuickDate(option: typeof QUICK_OPTIONS[number]): Date {
  const now = new Date();
  if (option.custom === 'tomorrow9') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (option.custom === 'tomorrow14') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d;
  }
  return new Date(now.getTime() + (option.minutes ?? 0) * 60 * 1000);
}

function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const ScheduleDateTimePicker: React.FC<ScheduleDateTimePickerProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const now = useMemo(() => new Date(), [visible]);
  const [mode, setMode] = useState<'quick' | 'custom'>('quick');
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedHour, setSelectedHour] = useState(now.getHours());
  const [selectedMinute, setSelectedMinute] = useState(
    Math.ceil(now.getMinutes() / 5) * 5 % 60,
  );

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      const fresh = new Date();
      setSelectedDay(fresh.getDate());
      setSelectedMonth(fresh.getMonth());
      setSelectedYear(fresh.getFullYear());
      setSelectedHour(fresh.getHours());
      setSelectedMinute(Math.ceil(fresh.getMinutes() / 5) * 5 % 60);
      setMode('quick');
    }
  }, [visible]);

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const buildDate = useCallback((): Date => {
    return new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute, 0, 0);
  }, [selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute]);

  const handleQuickSelect = useCallback((option: typeof QUICK_OPTIONS[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const date = getQuickDate(option);
    onConfirm(date);
  }, [onConfirm]);

  const handleCustomConfirm = useCallback(() => {
    const date = buildDate();
    if (date <= new Date()) {
      return; // Don't allow past dates
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(date);
  }, [buildDate, onConfirm]);

  const isCustomDateValid = useMemo(() => {
    const date = buildDate();
    return date > new Date();
  }, [buildDate]);

  const formattedPreview = useMemo(() => {
    const date = buildDate();
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    return `${dayName} ${selectedDay} ${MONTHS[selectedMonth]} ${selectedYear} à ${padZero(selectedHour)}:${padZero(selectedMinute)}`;
  }, [buildDate, selectedDay, selectedMonth, selectedYear, selectedHour, selectedMinute]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={colors.background.gradient.app}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Programmer le message</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.light} />
              </TouchableOpacity>
            </View>

            {/* Mode Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, mode === 'quick' && styles.tabActive]}
                onPress={() => setMode('quick')}
              >
                <Ionicons
                  name="flash-outline"
                  size={16}
                  color={mode === 'quick' ? colors.text.light : withOpacity(colors.text.light, 0.5)}
                />
                <Text style={[styles.tabText, mode === 'quick' && styles.tabTextActive]}>
                  Rapide
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'custom' && styles.tabActive]}
                onPress={() => setMode('custom')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={mode === 'custom' ? colors.text.light : withOpacity(colors.text.light, 0.5)}
                />
                <Text style={[styles.tabText, mode === 'custom' && styles.tabTextActive]}>
                  Personnalisé
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {mode === 'quick' ? (
                <View style={styles.quickOptions}>
                  {QUICK_OPTIONS.map((option, idx) => {
                    const date = getQuickDate(option);
                    const timeStr = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickOption}
                        onPress={() => handleQuickSelect(option)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" size={20} color={colors.primary.main} />
                        <View style={styles.quickOptionText}>
                          <Text style={styles.quickOptionLabel}>{option.label}</Text>
                          <Text style={styles.quickOptionTime}>{timeStr}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={withOpacity(colors.text.light, 0.3)} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.customPicker}>
                  {/* Date Row */}
                  <Text style={styles.sectionLabel}>DATE</Text>
                  <View style={styles.pickerRow}>
                    {/* Day */}
                    <View style={styles.pickerCol}>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedDay(d => d < daysInMonth ? d + 1 : 1)}
                      >
                        <Ionicons name="chevron-up" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerValue}>{padZero(selectedDay)}</Text>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedDay(d => d > 1 ? d - 1 : daysInMonth)}
                      >
                        <Ionicons name="chevron-down" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerLabel}>Jour</Text>
                    </View>

                    {/* Month */}
                    <View style={styles.pickerCol}>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedMonth(m => m < 11 ? m + 1 : 0)}
                      >
                        <Ionicons name="chevron-up" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerValue}>{MONTHS[selectedMonth].substring(0, 3)}</Text>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedMonth(m => m > 0 ? m - 1 : 11)}
                      >
                        <Ionicons name="chevron-down" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerLabel}>Mois</Text>
                    </View>

                    {/* Year */}
                    <View style={styles.pickerCol}>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedYear(y => y + 1)}
                      >
                        <Ionicons name="chevron-up" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerValue}>{selectedYear}</Text>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedYear(y => Math.max(y - 1, now.getFullYear()))}
                      >
                        <Ionicons name="chevron-down" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerLabel}>Année</Text>
                    </View>
                  </View>

                  {/* Time Row */}
                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>HEURE</Text>
                  <View style={styles.pickerRow}>
                    {/* Hour */}
                    <View style={styles.pickerCol}>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedHour(h => h < 23 ? h + 1 : 0)}
                      >
                        <Ionicons name="chevron-up" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerValue}>{padZero(selectedHour)}</Text>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedHour(h => h > 0 ? h - 1 : 23)}
                      >
                        <Ionicons name="chevron-down" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerLabel}>Heures</Text>
                    </View>

                    <Text style={styles.timeSeparator}>:</Text>

                    {/* Minute */}
                    <View style={styles.pickerCol}>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedMinute(m => m < 55 ? m + 5 : 0)}
                      >
                        <Ionicons name="chevron-up" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerValue}>{padZero(selectedMinute)}</Text>
                      <TouchableOpacity
                        style={styles.pickerArrow}
                        onPress={() => setSelectedMinute(m => m > 0 ? m - 5 : 55)}
                      >
                        <Ionicons name="chevron-down" size={20} color={colors.text.light} />
                      </TouchableOpacity>
                      <Text style={styles.pickerLabel}>Minutes</Text>
                    </View>
                  </View>

                  {/* Preview */}
                  <View style={styles.preview}>
                    <Ionicons name="calendar" size={16} color={colors.primary.main} />
                    <Text style={styles.previewText}>{formattedPreview}</Text>
                  </View>

                  {/* Confirm Button */}
                  <TouchableOpacity
                    onPress={handleCustomConfirm}
                    disabled={!isCustomDateValid}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={isCustomDateValid ? ['#FFB07B', '#F04882'] : ['#555', '#444']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.confirmButton}
                    >
                      <Ionicons name="send" size={18} color={colors.text.light} />
                      <Text style={styles.confirmButtonText}>
                        Programmer l'envoi
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {!isCustomDateValid && (
                    <Text style={styles.errorText}>
                      La date doit être dans le futur
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: withOpacity(colors.primary.main, 0.2),
    borderLeftColor: withOpacity(colors.primary.main, 0.1),
    borderRightColor: withOpacity(colors.primary.main, 0.1),
  },
  gradient: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(colors.ui.divider, 0.2),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: withOpacity(colors.primary.main, 0.2),
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: withOpacity(colors.text.light, 0.5),
  },
  tabTextActive: {
    color: colors.text.light,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  quickOptions: {
    gap: 8,
  },
  quickOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    borderWidth: 1,
    borderColor: withOpacity(colors.ui.divider, 0.1),
  },
  quickOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  quickOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.light,
  },
  quickOptionTime: {
    fontSize: 12,
    color: withOpacity(colors.text.light, 0.5),
    marginTop: 2,
  },
  customPicker: {
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: withOpacity(colors.text.light, 0.5),
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  pickerCol: {
    alignItems: 'center',
    minWidth: 70,
  },
  pickerArrow: {
    padding: 8,
  },
  pickerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.light,
    paddingVertical: 8,
    minWidth: 60,
    textAlign: 'center',
    backgroundColor: withOpacity(colors.background.dark, 0.4),
    borderRadius: 10,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 11,
    color: withOpacity(colors.text.light, 0.4),
    marginTop: 4,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.light,
    marginBottom: 20,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.primary.main, 0.1),
    borderWidth: 1,
    borderColor: withOpacity(colors.primary.main, 0.2),
    gap: 8,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light,
  },
  errorText: {
    fontSize: 12,
    color: '#F04882',
    textAlign: 'center',
    marginTop: 8,
  },
});
