/**
 * MessageBubble - Individual message display component
 */

import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MessageWithRelations } from '../../types/messaging';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { DeliveryStatus } from './DeliveryStatus';
import { ReactionBar } from './ReactionBar';
import { ReplyPreview } from './ReplyPreview';
import { ReactionPicker } from './ReactionPicker';
import { MediaMessage } from './MediaMessage';

interface MessageBubbleProps {
  message: MessageWithRelations;
  isSent: boolean;
  currentUserId: string;
  onReactionPress?: (messageId: string, emoji: string) => void;
  onReplyPress?: (messageId: string) => void;
  onLongPress?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSent,
  currentUserId,
  onReactionPress,
  onReplyPress,
  onLongPress,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Safety check
  if (!message || (!message.content && !message.is_deleted)) {
    return null;
  }

  const displayContent = message.is_deleted && message.delete_for_everyone
    ? '[Message supprimé]'
    : message.content;

  // Check if message has media attachments
  const hasMedia = message.attachments && message.attachments.length > 0;
  const firstAttachment = hasMedia && message.attachments ? message.attachments[0] : null;

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onLongPress) {
      onLongPress();
    } else {
      setShowReactionPicker(true);
    }
  };

  const handleReactionSelect = (emoji: string) => {
    onReactionPress?.(message.id, emoji);
  };

  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Animate on mount
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 300 });
    
    if (isSent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [scale, opacity, isSent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const renderBubbleContent = () => {
    if (isSent) {
      return (
        <LinearGradient
          colors={['#FFB07B', '#F86F71', '#F04882']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sentBubble}
        >
          {message.reply_to && (
            <ReplyPreview
              replyTo={message.reply_to}
              onPress={() => onReplyPress?.(message.reply_to!.id)}
            />
          )}
          {hasMedia && firstAttachment && firstAttachment.metadata && (
            <MediaMessage
              uri={firstAttachment.metadata.thumbnail_url || ''}
              type={firstAttachment.media_type}
              filename={firstAttachment.metadata.filename}
              size={firstAttachment.metadata.size}
              thumbnailUri={firstAttachment.metadata.thumbnail_url}
            />
          )}
          {displayContent && (
            <Text
              style={[
                styles.sentText,
                message.is_deleted && message.delete_for_everyone && styles.deletedText,
              ]}
            >
              {displayContent}
            </Text>
          )}
          <View style={styles.footer}>
            <Text style={styles.timestamp}>
              {new Date(message.sent_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {message.edited_at && (
              <Text style={[styles.editedLabel, { color: colors.text.tertiary }]}>
                {' '}édité
              </Text>
            )}
            <DeliveryStatus status={message.status || 'sent'} />
          </View>
        </LinearGradient>
      );
    }

    return (
      <View
        style={[
          styles.receivedBubble,
          { backgroundColor: themeColors.background.secondary },
        ]}
      >
        {message.reply_to && (
          <ReplyPreview
            replyTo={message.reply_to}
            onPress={() => onReplyPress?.(message.reply_to!.id)}
          />
        )}
        {hasMedia && firstAttachment && firstAttachment.metadata && (
          <MediaMessage
            uri={firstAttachment.metadata.thumbnail_url || ''}
            type={firstAttachment.media_type}
            filename={firstAttachment.metadata.filename}
            size={firstAttachment.metadata.size}
            thumbnailUri={firstAttachment.metadata.thumbnail_url}
          />
        )}
        {displayContent && (
          <Text
            style={[
              styles.receivedText,
              { color: themeColors.text.primary },
              message.is_deleted && message.delete_for_everyone && styles.deletedText,
            ]}
          >
            {displayContent}
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={[styles.timestamp, { color: colors.text.tertiary }]}>
            {new Date(message.sent_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {message.edited_at && (
            <Text style={[styles.editedLabel, { color: colors.text.tertiary }]}>
              {' '}édité
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        <Animated.View
          style={[
            isSent ? styles.sentContainer : styles.receivedContainer,
            animatedStyle,
          ]}
        >
          {renderBubbleContent()}
          {message.reactions && message.reactions.length > 0 && (
            <ReactionBar
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReactionPress={handleReactionSelect}
            />
          )}
        </Animated.View>
      </Pressable>
      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onReactionSelect={handleReactionSelect}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sentContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  sentBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  sentText: {
    color: colors.text.light,
    fontSize: 15,
    marginBottom: 4,
  },
  receivedContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 16,
  },
  receivedBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  receivedText: {
    fontSize: 15,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginRight: 4,
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    marginRight: 4,
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
});

export default memo(MessageBubble, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.edited_at === nextProps.message.edited_at &&
    prevProps.message.is_deleted === nextProps.message.is_deleted &&
    JSON.stringify(prevProps.message.reactions) === JSON.stringify(nextProps.message.reactions)
  );
});

