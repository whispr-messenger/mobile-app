import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { Logo, Button, Input } from './src/components';
import { colors, spacing } from './src/theme';

export default function App() {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Logo variant="icon" size="large" />
          <Text style={styles.title}>Whispr Mobile</Text>
          <Text style={styles.subtitle}>Design System Test - WHISPR-118</Text>
        </View>

        {/* Logos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logos</Text>
          <View style={styles.row}>
            <Logo variant="icon" size="small" />
            <Logo variant="icon" size="medium" />
            <Logo variant="icon" size="large" />
          </View>
        </View>

        {/* Buttons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buttons</Text>
          
          <Button
            title="Primary Button"
            variant="primary"
            onPress={() => Alert.alert('Primary button pressed!')}
            fullWidth
          />
          
          <Button
            title="Secondary Button"
            variant="secondary"
            onPress={() => Alert.alert('Secondary button pressed!')}
            fullWidth
          />
          
          <Button
            title="Ghost Button"
            variant="ghost"
            onPress={() => Alert.alert('Ghost button pressed!')}
            fullWidth
          />
          
          <Button
            title="Disabled Button"
            variant="primary"
            onPress={() => {}}
            disabled
            fullWidth
          />
          
          <View style={styles.row}>
            <Button
              title="Small"
              variant="primary"
              size="small"
              onPress={() => {}}
            />
            <Button
              title="Medium"
              variant="primary"
              size="medium"
              onPress={() => {}}
            />
            <Button
              title="Large"
              variant="primary"
              size="large"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Inputs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inputs</Text>
          
          <Input
            label="Phone Number"
            placeholder="+33 6 12 34 56 78"
            keyboardType="phone-pad"
          />
          
          <Input
            label="Username"
            placeholder="Enter your username"
            helperText="This will be visible to others"
          />
          
          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
          />
          
          <Input
            label="Error Example"
            placeholder="Invalid input"
            error="This field is required"
          />
        </View>

        {/* Colors Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          <View style={styles.colorGrid}>
            <View style={[styles.colorBox, { backgroundColor: colors.primary.main }]} />
            <View style={[styles.colorBox, { backgroundColor: colors.secondary.main }]} />
            <View style={[styles.colorBox, { backgroundColor: colors.secondary.dark }]} />
            <View style={[styles.colorBox, { backgroundColor: colors.ui.success }]} />
          </View>
        </View>

      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: spacing.base,
    color: colors.primary.main,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
});
