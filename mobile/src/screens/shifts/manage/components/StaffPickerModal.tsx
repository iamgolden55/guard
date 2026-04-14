/**
 * StaffPickerModal - full-screen multi-select picker for team members.
 * Fed from GET /api/v1/users/team-members/ (same endpoint TeamScreen uses).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../../../../services/api';
import { API_ENDPOINTS } from '../../../../config/api.config';
import { useTheme } from '../../../../hooks/useTheme';
import { getUberColors, uberRadius, uberSpacing } from '../../../../theme/uberTheme';
import { logger } from '../../../../utils/logger';

export interface StaffPickerMember {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  security_roles: string[];
  profile_image_url: string | null;
  is_current_user: boolean;
}

interface StaffPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (selected: StaffPickerMember[]) => void;
  initialSelectedIds?: number[];
}

export const StaffPickerModal: React.FC<StaffPickerModalProps> = ({
  visible,
  onClose,
  onApply,
  initialSelectedIds,
}) => {
  const { isDark } = useTheme();
  const colors = getUberColors(isDark);

  const [members, setMembers] = useState<StaffPickerMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) return;
    // Reset selection from initial each time the modal opens.
    setSelectedIds(new Set(initialSelectedIds ?? []));
    setSearch('');

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiService.get<StaffPickerMember[]>(API_ENDPOINTS.TEAM.MEMBERS);
        if (!cancelled) {
          setMembers(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        logger.error('[StaffPicker] failed to load members', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load team members');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // Intentionally excluding initialSelectedIds from deps — we only reset when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
    );
  }, [members, search]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyDisabled = selectedIds.size === 0;

  const handleApply = () => {
    const chosen = members.filter((m) => selectedIds.has(m.id));
    onApply(chosen);
    onClose();
  };

  const renderItem = ({ item }: { item: StaffPickerMember }) => {
    const active = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: active ? `${colors.primary}15` : colors.background.light,
            borderColor: active ? colors.primary : colors.border.light,
          },
        ]}
        onPress={() => toggle(item.id)}
        activeOpacity={0.7}
      >
        {item.profile_image_url ? (
          <Image source={{ uri: item.profile_image_url }} style={styles.avatar} />
        ) : (
          <View
            style={[styles.avatarPlaceholder, { backgroundColor: colors.background.surface }]}
          >
            <Text style={[styles.avatarInitials, { color: colors.text.primary }]}>
              {(item.first_name?.[0] || '').toUpperCase()}
              {(item.last_name?.[0] || '').toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={[styles.meta, { color: colors.text.secondary }]} numberOfLines={1}>
            {item.security_roles?.length
              ? item.security_roles.join(', ').toUpperCase()
              : item.role}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: active ? colors.primary : colors.border.light,
              backgroundColor: active ? colors.primary : 'transparent',
            },
          ]}
        >
          {active && <Ionicons name="checkmark" size={14} color={colors.text.inverse} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.light }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background.surface, borderBottomColor: colors.border.light },
          ]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select staff'}
          </Text>
          <TouchableOpacity
            onPress={handleApply}
            disabled={applyDisabled}
            hitSlop={10}
            style={{ opacity: applyDisabled ? 0.4 : 1 }}
          >
            <Text style={[styles.applyText, { color: colors.primary }]}>Apply</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.background.surface }]}>
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search by name"
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {isLoading && members.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={{ color: colors.text.secondary }}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerBox}>
                <Text style={{ color: colors.text.secondary }}>No team members found.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  applyText: { fontSize: 15, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.sm,
    marginHorizontal: uberSpacing.base,
    marginTop: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.md,
  },
  searchInput: { flex: 1, fontSize: 14 },
  listContent: {
    flexGrow: 1,
    padding: uberSpacing.base,
    gap: uberSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.md,
    paddingVertical: uberSpacing.sm,
    paddingHorizontal: uberSpacing.md,
    borderRadius: uberRadius.md,
    borderWidth: 1,
    marginBottom: uberSpacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 14, fontWeight: '700' },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: uberSpacing.xl,
  },
});
