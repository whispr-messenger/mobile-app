/**
 * ReactionBar - Display reactions for a message
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ReactionButton } from './ReactionButton';
import { MessageReaction } from '../../types/messaging';

interface ReactionBarProps {
  reactions: MessageReaction[];
  currentUserId: string;
  onReactionPress: (emoji: string) => void;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  reactions,
  currentUserId,
  onReactionPress,
}) => {
  // Aggregate reactions by emoji
  const reactionSummary = useMemo(() => {
    const summary: Record<string, { count: number; userReacted: boolean }> = {};

    reactions.forEach(reaction => {
      if (!summary[reaction.reaction]) {
        summary[reaction.reaction] = {
          count: 0,
          userReacted: false,
        };
      }
      summary[reaction.reaction].count++;
      if (reaction.user_id === currentUserId) {
        summary[reaction.reaction].userReacted = true;
      }
    });

    return summary;
  }, [reactions, currentUserId]);

  if (Object.keys(reactionSummary).length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {Object.entries(reactionSummary).map(([emoji, data]) => (
        <ReactionButton
          key={emoji}
          emoji={emoji}
          count={data.count}
          isActive={data.userReacted}
          onPress={() => onReactionPress(emoji)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 2,
  },
});

